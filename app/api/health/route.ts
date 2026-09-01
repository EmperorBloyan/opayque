import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getSolanaRpcUrl } from "@/lib/solana/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const checks = { rpc: false, supabase: false };
  try {
    await new Connection(getSolanaRpcUrl(), "confirmed").getSlot();
    checks.rpc = true;
  } catch {
    // Health responses intentionally omit provider details and credentials.
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("merchants").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const healthy = checks.rpc && checks.supabase;
  return NextResponse.json({ ok: healthy, checks }, { status: healthy ? 200 : 503 });
}
