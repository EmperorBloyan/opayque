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
    const { data: terminal, error: lookupError } = await supabase
      .from("terminals")
      .select("id, status")
      .eq("id", terminalId)
      .eq("device_token", deviceToken)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
    }
    if (!terminal) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
    }

    const { data: revokedTerminal, error } = await supabase
      .from("terminals")
      .update({ status: "revoked", last_active: new Date().toISOString() })
      .eq("id", terminal.id)
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