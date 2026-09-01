import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getSolanaNetworkConfig } from "@/lib/solana/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const network = getSolanaNetworkConfig();
  const rpcResults = await Promise.all(network.rpcUrls.map(async (url) => {
    try {
      const slot = await new Connection(url, "confirmed").getSlot();
      return { url, ok: true, slot };
    } catch {
      return { url, ok: false };
    }
  }));
  const checks = { rpc: rpcResults.some((result) => result.ok), supabase: false };

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("merchants").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const healthy = checks.rpc && checks.supabase;
  return NextResponse.json({
    ok: healthy,
    network: network.network,
    isMainnet: network.isMainnet,
    checks,
    rpc: rpcResults.map(({ url, ...result }) => ({ endpoint: new URL(url).host, ...result })),
    magicBlockConfigured: Boolean(process.env.NEXT_PUBLIC_MAGICBLOCK_API?.trim()),
  }, { status: healthy ? 200 : 503 });
}
