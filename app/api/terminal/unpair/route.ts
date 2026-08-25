import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    const deviceToken = typeof body?.deviceToken === "string" ? body.deviceToken.trim() : "";

    if (!terminalId || !deviceToken) {
      return NextResponse.json({ success: false, error: "Terminal credentials are required" }, { status: 400 });
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
      .eq("device_token", deviceToken)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
    }
    if (!terminal) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
    }
    if (terminal.merchant_id !== merchant.id) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 403 });
    }

    const { data: revokedTerminal, error } = await supabase
      .from("terminals")
      .update({ status: "revoked", last_active: new Date().toISOString() })
      .eq("id", terminal.id)
      .eq("merchant_id", merchant.id)
      .eq("device_token", deviceToken)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!revokedTerminal) {
      return NextResponse.json({ success: false, error: "Terminal could not be unpaired" }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to unpair terminal" }, { status: 500 });
  }
}