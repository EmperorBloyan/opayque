import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { hashDeviceToken } from "@/lib/terminal/deviceAuth";

interface PairTerminalRequest {
  merchant_id?: string;
  terminal_label?: string;
}

export async function POST(request: Request) {
  try {
    const rateLimit = await strictLimit(`terminal:pair:${getClientAddress(request)}`, true);
    if (!rateLimit.allowed) return NextResponse.json({ success: false, error: rateLimit.error || "Too many pairing requests" }, { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const body = (await request.json()) as PairTerminalRequest;
    const terminalLabel = body.terminal_label?.trim();

    if (!terminalLabel) {
      return NextResponse.json({ success: false, error: "terminal_label is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient(request);
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

    if (!merchant?.id) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    }

    const merchantId = merchant.id;
    const deviceToken = randomUUID();

    try {
      const { data, error } = await supabase
        .from("terminals")
        .insert({
          merchant_id: merchantId,
          terminal_label: terminalLabel,
          device_token_hash: hashDeviceToken(deviceToken),
          status: "online",
        })
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: error?.message || "Terminal creation failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: { terminal: data, device_token: deviceToken } });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Pairing failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Pairing failed" }, { status: 500 });
  }
}