import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

interface PairTerminalRequest {
  merchant_id?: string;
  terminal_label?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PairTerminalRequest;
    const merchantId = body.merchant_id?.trim();
    const terminalLabel = body.terminal_label?.trim();

    if (!merchantId || !terminalLabel) {
      return NextResponse.json({ success: false, error: "merchant_id and terminal_label are required" }, { status: 400 });
    }

    const deviceToken = randomUUID();
    const supabase = await createSupabaseServerClient();

    try {
      const { data, error } = await supabase
        .from("terminals")
        .insert({
          merchant_id: merchantId,
          terminal_label: terminalLabel,
          device_token: deviceToken,
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