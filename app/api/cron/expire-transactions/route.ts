import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EXPIRY_WINDOW_MS = 15 * 60 * 1000;
const MAX_BATCH = 500;

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - EXPIRY_WINDOW_MS).toISOString();
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("status", ["created", "pending_signature", "submitted"])
      .lt("updated_at", cutoff)
      .limit(MAX_BATCH)
      .select("id");

    if (error) throw error;
    return NextResponse.json({ success: true, expired: data?.length ?? 0 });
  } catch (error: unknown) {
    console.error("Transaction expiry failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "Unable to expire transactions" }, { status: 500 });
  }
}
