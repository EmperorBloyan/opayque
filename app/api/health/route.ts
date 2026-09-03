import { NextResponse } from "next/server";
import { getProductionConfigIssues, getSolanaNetworkConfig } from "@/lib/solana/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { probeSolanaRpcs } from "@/lib/solana/rpc";

export async function GET() {
  const network = getSolanaNetworkConfig();
  const rpcResults = await probeSolanaRpcs(network.rpcUrls);
  const checks = { rpc: rpcResults.some((result) => result.ok), supabase: false };

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("merchants").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const configIssues = getProductionConfigIssues();
  const selected = rpcResults
    .filter((result) => result.ok)
    .sort((left, right) => (left.latencyMs ?? Infinity) - (right.latencyMs ?? Infinity))[0];
  const healthy = checks.rpc && checks.supabase && configIssues.length === 0;
  return NextResponse.json({
    ok: healthy,
    network: network.network,
    isMainnet: network.isMainnet,
    checks,
    selectedRpc: selected ? { endpoint: new URL(selected.url).host, latencyMs: selected.latencyMs, slot: selected.slot } : null,
    rpc: rpcResults.map(({ url, error: _error, ...result }) => ({ endpoint: new URL(url).host, ...result })),
    configIssues: configIssues.map(({ key, message }) => ({ key, message })),
    magicBlockConfigured: Boolean(process.env.NEXT_PUBLIC_MAGICBLOCK_API?.trim()),
  }, { status: healthy ? 200 : 503 });
}
