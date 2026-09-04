import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { hashDeviceToken } from "@/lib/terminal/deviceAuth";

export async function POST(request: Request) {
  try {
    const rateLimit = await strictLimit(`terminal:unpair:${getClientAddress(request)}`, process.env.NODE_ENV === "production");
    if (!rateLimit.allowed) return NextResponse.json({ success: false, error: rateLimit.error || "Too many unpair requests" }, { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const body = await request.json().catch(() => ({}));
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    const deviceToken = typeof body?.deviceToken === "string" ? body.deviceToken.trim() : "";

    if (!terminalId) {
      return NextResponse.json({ success: false, error: "Terminal ID is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (merchantError) {
      return NextResponse.json({ success: false, error: merchantError.message }, { status: 500 });
    }
    if (!merchant) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 403 });
    }

    const { data: terminal, error: lookupError } = await supabase
      .from("terminals")
      .select("id, status, merchant_id")
      .eq("id", terminalId)
      .eq("merchant_id", merchant.id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
    }
    if (!terminal || ["revoked", "unpaired", "deleted"].includes(String(terminal.status).toLowerCase())) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
    }
    if (deviceToken) {
      const { data: tokenMatch, error: tokenError } = await supabase
        .from("terminals")
        .select("id")
        .eq("id", terminal.id)
        .eq("device_token_hash", hashDeviceToken(deviceToken))
        .maybeSingle();
      if (tokenError) return NextResponse.json({ success: false, error: tokenError.message }, { status: 500 });
      if (!tokenMatch) return NextResponse.json({ success: false, error: "Terminal authentication failed" }, { status: 401 });
    }

    const { data: deletedTerminal, error } = await supabase
      .from("terminals")
      .delete()
      .eq("id", terminal.id)
      .eq("merchant_id", merchant.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!deletedTerminal) {
      return NextResponse.json({ success: false, error: "Terminal could not be unpaired" }, { status: 409 });
    }

    return NextResponse.json({ success: true, terminalId: terminal.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to unpair terminal" }, { status: 500 });
  }
}