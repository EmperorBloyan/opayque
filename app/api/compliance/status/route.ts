import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getComplianceProvider } from "@/lib/compliance/providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("screening_status, screened_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "Unable to read compliance status" }, { status: 500 });

  const provider = getComplianceProvider();
  return NextResponse.json({
    success: true,
    provider: provider.name,
    configured: provider.isConfigured(),
    status: provider.isConfigured() ? (merchant?.screening_status || "pending") : "not_configured",
    screenedAt: merchant?.screened_at || null,
    message: provider.isConfigured()
      ? "Provider status is informational until the configured provider completes its review."
      : "No compliance provider is configured. Opayque is not making a KYB or KYC decision.",
  });
}