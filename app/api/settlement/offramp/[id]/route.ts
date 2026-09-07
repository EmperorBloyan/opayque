import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOfframpProvider } from "@/lib/settlement/offramp";

export async function GET(request: Request, context: { params: { id: string } }) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (merchantError) return NextResponse.json({ success: false, error: "Unable to resolve merchant profile" }, { status: 500 });
  if (!merchant) return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 403 });

  const { data: payout, error } = await supabase
    .from("offramp_payouts")
    .select("provider, provider_payout_id, amount_usdc, status, created_at, updated_at")
    .eq("provider_payout_id", context.params.id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (error || !payout) return NextResponse.json({ success: false, error: "Payout not found" }, { status: 404 });

  const provider = getOfframpProvider();
  if (provider.name !== payout.provider || !provider.isConfigured()) {
    return NextResponse.json({ success: true, status: payout.status, provider: payout.provider, configured: false, message: "The external payout provider is not configured." });
  }

  const latest = await provider.getPayoutStatus(payout.provider_payout_id);
  if (latest.status !== payout.status) {
    await supabase.from("offramp_payouts").update({ status: latest.status, updated_at: new Date().toISOString() }).eq("provider_payout_id", payout.provider_payout_id);
  }
  return NextResponse.json({ success: true, provider: payout.provider, configured: true, status: latest.status, payoutId: payout.provider_payout_id, amountUsdc: payout.amount_usdc, createdAt: payout.created_at, updatedAt: new Date().toISOString(), message: latest.message });
}