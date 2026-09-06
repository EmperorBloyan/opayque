"use client";

import { useEffect, useState } from "react";

type ProviderStatus = {
  provider: string;
  configured: boolean;
  status: string;
  message: string;
};

function StatusPill({ configured, status }: { configured: boolean; status: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function CompliancePage() {
  const [compliance, setCompliance] = useState<ProviderStatus | null>(null);
  const [offramp, setOfframp] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/compliance/status", { credentials: "include" }).then((response) => response.json()),
      fetch("/api/settlement/offramp/status", { credentials: "include" }).then((response) => response.json()),
    ]).then(([compliancePayload, offrampPayload]) => {
      if (!active) return;
      if (compliancePayload?.success) setCompliance(compliancePayload);
      if (offrampPayload?.success) setOfframp(offrampPayload);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl rounded-[3rem] border border-white/10 bg-zinc-950 p-8 shadow-2xl">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Merchant safeguards</p>
          <h1 className="mt-2 text-4xl font-black tracking-tighter">Compliance and settlement partners</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Opayque settles crypto on Solana and does not hold fiat. Compliance screening and fiat conversion are optional services provided by explicitly configured external partners.
          </p>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Compliance screening</p>
                <h2 className="mt-2 text-2xl font-black">{compliance?.provider || "Loading provider"}</h2>
              </div>
              {compliance && <StatusPill configured={compliance.configured} status={compliance.status} />}
            </div>
            <p className="mt-6 text-sm leading-6 text-zinc-400">{compliance?.message || "Checking whether a screening provider is configured."}</p>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
              Demo screening is never a KYB or KYC decision. A real provider such as Sumsub must complete its own review before a merchant treats the result as operational evidence.
            </p>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Fiat payout partner</p>
                <h2 className="mt-2 text-2xl font-black">{offramp?.provider || "Loading provider"}</h2>
              </div>
              {offramp && <StatusPill configured={offramp.configured} status={offramp.status} />}
            </div>
            <p className="mt-6 text-sm leading-6 text-zinc-400">{offramp?.message || "Checking whether an external payout partner is configured."}</p>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
              Opayque never sends bank transfers or stores bank account details. A configured partner receives settled USDC and handles any later fiat payout under its own compliance and terms.
            </p>
          </section>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Settlement boundary</p>
          <h2 className="mt-2 text-xl font-black">Crypto settlement remains separate</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Payment records describe on-chain USDC settlement. Any later external conversion has its own partner payout ID and status; it must never change a confirmed Solana payment into a claim that Opayque paid fiat.
          </p>
        </section>
      </div>
    </div>
  );
}