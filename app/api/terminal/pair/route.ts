import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

interface PairTerminalRequest {
  merchant_id?: string;
  terminal_label?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Safe body parsing
    const body = (await request.json().catch(() => null)) as PairTerminalRequest | null;
    const merchantId = body?.merchant_id?.trim();
    const terminalLabel = body?.terminal_label?.trim();

    if (!merchantId || !terminalLabel) {
      return NextResponse.json(
        { success: false, error: "merchant_id and terminal_label are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 2. Authenticate the caller
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3. Generate device token & store terminal
    const deviceToken = randomUUID();

    const { data: terminal, error: dbError } = await supabase
      .from("terminals")
      .insert({
        merchant_id: merchantId,
        terminal_label: terminalLabel,
        device_token: deviceToken,
        status: "online",
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        terminal,
        device_token: deviceToken,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected pairing error occurred",
      },
      { status: 500 }
    );
  }
}
