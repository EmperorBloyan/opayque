"use client";

import { useState } from "react";

export default function CompliancePage() {
  const [iban, setIban] = useState("");
  const [routing, setRouting] = useState("");
  const [autoSettle, setAutoSettle] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl rounded-[3rem] border border-white/10 bg-zinc-950 p-8 shadow-2xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Merchant Compliance</p>
            <h1 className="mt-2 text-4xl font-black tracking-tighter">Payout routing, settlement rules, and sanctions checks</h1>
          </div>
          <div className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300">
            Sandbox mode
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-black uppercase tracking-[0.2em]">Bank payout details</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm text-zinc-400">
                IBAN / Account Number
                <input value={iban} onChange={(event) => setIban(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-zinc-400">
                Routing / Sort Code
                <input value={routing} onChange={(event) => setRouting(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none" />
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-black uppercase tracking-[0.2em]">Settlement preferences</h2>
            <div className="mt-5 space-y-4 text-sm text-zinc-400">
              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black px-4 py-3">
                <span>Auto-settle daily</span>
                <input type="checkbox" checked={autoSettle} onChange={() => setAutoSettle((value) => !value)} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black px-4 py-3">
                <span>Accept Terms of Service</span>
                <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted((value) => !value)} />
              </label>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-black uppercase tracking-[0.2em]">Fee schedule</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Settlement fee</p>
              <p className="mt-2 text-2xl font-black">0.25%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Minimum payout</p>
              <p className="mt-2 text-2xl font-black">$10</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Sandbox delay</p>
              <p className="mt-2 text-2xl font-black">Instant</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
