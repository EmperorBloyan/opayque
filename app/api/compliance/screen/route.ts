import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { strictLimit, getClientAddress } from '@/lib/rate-limit';

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

    const mode = process.env.COMPLIANCE_PROVIDER || 'demo';
    if (mode === 'live' || (process.env.NODE_ENV === 'production' && mode === 'demo')) return NextResponse.json({ success: false, mode: 'demo', error: 'Live compliance screening is not configured' }, { status: 503 });
    const highRisk = ['IR','NK','SY'].includes(data.country.toUpperCase());
    const result = { status: highRisk ? 'rejected' : 'review', riskScore: highRisk ? 'high' : 'unknown', providerRef: `demo:${Date.now()}` };
    await supabase.from('merchants').update({ screening_status: result.status, risk_score: result.riskScore, provider_ref: result.providerRef, screened_at: new Date().toISOString(), screening_country: data.country.toUpperCase(), screening_business_name: data.businessName }).eq('id', data.merchantId);

    return NextResponse.json({
      success: true, mode,
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
