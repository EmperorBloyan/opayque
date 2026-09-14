import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { strictLimit, getClientAddress } from '@/lib/rate-limit';
import { getComplianceProvider } from '@/lib/compliance/providers';

const schema = z.object({
  merchantId: z.string().uuid(),
  businessName: z.string().min(2),
  country: z.string().length(2),
});

export async function POST(req: Request) {
  try {
    const limit = await strictLimit(`compliance:${getClientAddress(req)}`, true);
    if (!limit.allowed) return NextResponse.json({ success: false, error: limit.error || 'Too many screening requests' }, { status: limit.error ? 503 : 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    const supabase = createSupabaseServerClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const data = schema.parse(body);
    const { data: merchant } = await supabase.from('merchants').select('id').eq('id', data.merchantId).eq('auth_user_id', user.id).maybeSingle();
    if (!merchant) return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 403 });

    const provider = getComplianceProvider();
    const result = await provider.screenMerchant({
      merchantId: data.merchantId,
      businessName: data.businessName,
      country: data.country.toUpperCase(),
    });
    if (result.status !== 'not_configured') {
      await supabase.from('merchants').update({
        screening_status: result.status,
        risk_score: result.riskScore,
        provider_ref: result.providerRef,
        screened_at: new Date().toISOString(),
        screening_country: data.country.toUpperCase(),
        screening_business_name: data.businessName,
      }).eq('id', data.merchantId);
    }

    return NextResponse.json({
      success: true,
      provider: provider.name,
      configured: provider.isConfigured(),
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
