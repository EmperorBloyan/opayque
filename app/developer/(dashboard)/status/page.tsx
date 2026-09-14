"use client";

import { useEffect, useState } from "react";

interface DependencyCheck {
  status: "ok" | "degraded" | "unhealthy" | "skipped";
  latencyMs: number | null;
  detail?: string;
  endpoint?: string;
  balanceLamports?: number;
  publicKey?: string;
}

interface HealthPayload {
  status: "ok" | "degraded" | "unhealthy";
  generatedAt: string;
  network: string;
  checks: Record<string, DependencyCheck>;
  environment: { issues: Array<{ key: string; message: string; severity: string }> };
}

const labels: Record<string, string> = {
  supabase: "Supabase",
  redis: "Rate limiting",
  rpc: "Solana RPC",
  magicBlock: "MagicBlock",
  relayer: "Relayer",
  anchorProgram: "Anchor program",
};

export default function DeveloperStatusPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const payload = await response.json();
      setHealth(payload);
      setError(null);
    } catch {
      setError("Unable to load service status");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Developer Hub</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Service status</h1>
            <p className="mt-2 text-sm text-zinc-400">Live readiness signals for the payment infrastructure.</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Refresh</button>
        </div>

        {error && <p className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
        {health && (
          <>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-400">
              <span className="rounded-full border border-white/10 px-3 py-1">Overall: <strong className="text-white">{health.status}</strong></span>
              <span className="rounded-full border border-white/10 px-3 py-1">Network: <strong className="text-white">{health.network}</strong></span>
              <span className="rounded-full border border-white/10 px-3 py-1">Updated: <strong className="text-white">{new Date(health.generatedAt).toLocaleTimeString()}</strong></span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(health.checks).map(([key, check]) => (
                <section key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">{labels[key] || key}</h2>
                    <span className={`text-xs font-bold uppercase ${check.status === "ok" ? "text-emerald-300" : check.status === "degraded" ? "text-amber-300" : check.status === "skipped" ? "text-zinc-500" : "text-red-300"}`}>{check.status}</span>
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">{check.detail || (check.latencyMs !== null ? `${check.latencyMs} ms` : "No latency recorded")}</p>
                  {check.endpoint && <p className="mt-2 truncate text-xs text-zinc-600">{check.endpoint}</p>}
                  {check.publicKey && <p className="mt-2 truncate text-xs text-zinc-600">{check.publicKey}</p>}
                </section>
              ))}
            </div>
            {health.environment.issues.length > 0 && (
              <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <h2 className="font-semibold text-amber-200">Configuration attention</h2>
                <ul className="mt-3 space-y-2 text-sm text-amber-100/80">
                  {health.environment.issues.map((issue) => <li key={`${issue.key}-${issue.message}`}>{issue.key}: {issue.message}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
