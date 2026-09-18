import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { Redis } from "@upstash/redis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSolanaNetwork, getSolanaNetworkConfig } from "@/lib/solana/constants";
import { probeSolanaRpcs, type RpcProbeResult } from "@/lib/solana/rpc";
import { getSafeEnvironmentSummary, validateEnvironment, type EnvironmentStatus } from "@/lib/env/validate";

export type DependencyStatus = "ok" | "degraded" | "unhealthy" | "skipped";

export interface DependencyCheck {
  status: DependencyStatus;
  latencyMs: number | null;
  detail?: string;
  configured?: EnvironmentStatus;
  endpoint?: string;
}

export interface ReadinessReport {
  status: "ok" | "degraded" | "unhealthy";
  generatedAt: string;
  network: string;
  checks: {
    supabase: DependencyCheck;
    redis: DependencyCheck;
    rpc: DependencyCheck & { endpoints: Array<Omit<RpcProbeResult, "url" | "error"> & { endpoint: string; error?: string }> };
    magicBlock: DependencyCheck;
    relayer: DependencyCheck & { publicKey?: string; balanceLamports?: number };
    anchorProgram: DependencyCheck & { programId?: string };
  };
  environment: ReturnType<typeof getSafeEnvironmentSummary>;
}

function endpointHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-endpoint";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 5_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("probe timed out")), timeoutMs)),
  ]);
}

async function checkSupabase(): Promise<DependencyCheck> {
  const startedAt = Date.now();
  try {
    const client = createSupabaseServerClient();
    const result = await withTimeout<{ error?: unknown }>(client.from("merchants").select("id").limit(1));
    const error = result.error;
    return error
      ? { status: "unhealthy", latencyMs: Date.now() - startedAt, detail: "Supabase query failed" }
      : { status: "ok", latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - startedAt, detail: "Supabase probe failed" };
  }
}

async function checkRedis(): Promise<DependencyCheck> {
  const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
  if (!configured) return { status: "skipped", latencyMs: null, configured: "optional", detail: "Redis is not configured" };
  const startedAt = Date.now();
  try {
    await withTimeout(Redis.fromEnv().ping());
    return { status: "ok", latencyMs: Date.now() - startedAt, configured: "configured", endpoint: endpointHost(process.env.UPSTASH_REDIS_REST_URL || "") };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - startedAt, configured: "configured", endpoint: endpointHost(process.env.UPSTASH_REDIS_REST_URL || ""), detail: "Redis probe failed" };
  }
}

async function checkMagicBlock(): Promise<DependencyCheck> {
  const endpoint = process.env.NEXT_PUBLIC_MAGICBLOCK_API?.trim();
  if (!endpoint) return { status: "skipped", latencyMs: null, configured: "optional", detail: "MagicBlock is not configured" };
  const startedAt = Date.now();
  try {
    const response = await withTimeout(fetch(endpoint, {
      method: "HEAD",
      cache: "no-store",
      headers: process.env.MAGICBLOCK_API_KEY ? { Authorization: `Bearer ${process.env.MAGICBLOCK_API_KEY}` } : undefined,
    }));
    return { status: response.ok ? "ok" : "degraded", latencyMs: Date.now() - startedAt, configured: "configured", endpoint: endpointHost(endpoint), detail: `HTTP ${response.status}` };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - startedAt, configured: "configured", endpoint: endpointHost(endpoint), detail: "MagicBlock probe failed" };
  }
}

async function checkRelayer(rpcUrl: string | null): Promise<DependencyCheck & { publicKey?: string; balanceLamports?: number }> {
  const secret = process.env.RELAYER_PRIVATE_KEY?.trim();
  if (!secret) return { status: "skipped", latencyMs: null, configured: "optional", detail: "Relayer key is not configured" };
  const startedAt = Date.now();
  try {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    if (!rpcUrl) return { status: "degraded", latencyMs: null, configured: "configured", publicKey: keypair.publicKey.toBase58(), detail: "No healthy RPC available" };
    const balanceLamports = await withTimeout(new Connection(rpcUrl, "confirmed").getBalance(keypair.publicKey));
    return { status: "ok", latencyMs: Date.now() - startedAt, configured: "configured", publicKey: keypair.publicKey.toBase58(), balanceLamports };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - startedAt, configured: "configured", detail: "Relayer key or balance probe failed" };
  }
}

async function checkAnchorProgram(rpcUrl: string | null): Promise<DependencyCheck & { programId?: string }> {
  const programId = process.env.NEXT_PUBLIC_OPAYQUE_PROGRAM_ID?.trim() || "9tMdYGfZqKTURYHsgL1KSBK9h9i8EH9zRREhP7FcEKQL";
  if (!rpcUrl) return { status: "degraded", latencyMs: null, programId, detail: "No healthy RPC available" };
  const startedAt = Date.now();
  try {
    const account = await withTimeout(new Connection(rpcUrl, "confirmed").getAccountInfo(new PublicKey(programId)));
    return { status: account ? "ok" : "degraded", latencyMs: Date.now() - startedAt, programId, detail: account ? "Program account found" : "Program account not found" };
  } catch {
    return { status: "degraded", latencyMs: Date.now() - startedAt, programId, detail: "Program deployment probe failed" };
  }
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const environment = validateEnvironment();
  const network = getSolanaNetworkConfig();
  const [supabase, redis, magicBlock, rpcResults] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkMagicBlock(),
    probeSolanaRpcs(network.rpcUrls),
  ]);
  const healthyRpc = rpcResults.filter((result) => result.ok).sort((left, right) => (left.latencyMs ?? Infinity) - (right.latencyMs ?? Infinity))[0];
  const [relayer, anchorProgram] = await Promise.all([
    checkRelayer(healthyRpc?.url ?? null),
    checkAnchorProgram(healthyRpc?.url ?? null),
  ]);
  const rpc: ReadinessReport["checks"]["rpc"] = {
    status: healthyRpc ? (rpcResults.some((result) => !result.ok) ? "degraded" : "ok") : "unhealthy",
    latencyMs: healthyRpc?.latencyMs ?? null,
    endpoint: healthyRpc ? endpointHost(healthyRpc.url) : undefined,
    endpoints: rpcResults.map(({ url, error, ...result }) => ({ endpoint: endpointHost(url), ...result, ...(error ? { error: "RPC probe failed" } : {}) })),
  };
  const production = environment.environment === "production"
    && process.env.VERCEL_ENV !== "preview"
    && process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";
  const critical = [supabase, rpc, magicBlock, redis, relayer, anchorProgram].filter((check) => production ? check.status !== "ok" : check.status === "unhealthy");
  const degraded = [supabase, rpc, magicBlock, redis, relayer, anchorProgram].some((check) => check.status === "degraded");
  const status = critical.length > 0 ? "unhealthy" : degraded || !environment.ok ? "degraded" : "ok";

  return {
    status,
    generatedAt: new Date().toISOString(),
    network: getSolanaNetwork(),
    checks: { supabase, redis, rpc, magicBlock, relayer, anchorProgram },
    environment: getSafeEnvironmentSummary(),
  };
}
