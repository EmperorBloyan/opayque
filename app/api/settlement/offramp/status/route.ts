import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOfframpProvider } from "@/lib/settlement/offramp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const provider = getOfframpProvider();
  return NextResponse.json({
    success: true,
    provider: provider.name,
    configured: provider.isConfigured(),
    status: provider.isConfigured() ? "ready" : "not_configured",
    message: provider.isConfigured()
      ? "Fiat payouts are handled by the configured external partner. Opayque does not hold or send fiat."
      : "Fiat payouts are handled by an external partner. No partner is configured.",
  });
}