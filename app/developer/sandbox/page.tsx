'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Play, ArrowLeft, Settings2, ShieldCheck } from 'lucide-react';
import OpayqueCheckout from '@/components/OpayqueCheckout';

export default function DeveloperSandbox() {
  const router = useRouter();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderId, setOrderId] = useState(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState(15.0);
  const [apiKey, setApiKey] = useState('osk_live_9f87d6abcdef88219903');
  const [merchantWallet, setMerchantWallet] = useState('7xKXtg2b...3b9Y');

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="relative mx-auto flex min-h-screen items-center justify-center p-6">
        <div className="relative w-full max-w-4xl rounded-[4rem] border border-white/10 bg-zinc-950/95 p-10 shadow-2xl">
          <button
            type="button"
            onClick={() => router.push('/developer/overview')}
            className="absolute right-8 top-8 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} className="inline-block mr-2" /> Close
          </button>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Terminal className="w-5 h-5" /> Sandbox Simulation
              </div>
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-white">Launch Sandbox Fast</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                  This sandbox page matches the quickstart experience so you can test checkout flow with the same focused, immersive layout.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Sandbox Order ID</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">{orderId}</p>
                </div>
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Checkout Amount</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">{amount.toFixed(2)} USDC</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Environment API Key</p>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-3 w-full bg-[#050508] border border-[#1f293d] rounded-2xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all font-mono"
                  />
                </div>
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Merchant Wallet</p>
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.1em] text-white">{merchantWallet}</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:bg-purple-500"
                >
                  <Play size={18} /> Launch Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/developer/overview')}
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:border-purple-500/40 hover:bg-white/10"
                >
                  <ShieldCheck size={18} /> Close
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-900/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%)]" />
              <div className="relative space-y-6">
                <div className="flex items-center gap-3 text-purple-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-purple-500/10">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Sandbox status</p>
                    <p className="text-sm font-black uppercase tracking-[0.1em] text-white">Ready for sandbox deployment</p>
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Embedded experience</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">Run a sandbox checkout flow immediately and validate your integration without leaving the developer workspace.</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Next action</p>
                    <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white">Sandbox checkout</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Focus</p>
                    <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white">Quick, isolated flow validation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <OpayqueCheckout
          apiKey={apiKey}
          orderId={orderId}
          amountUsdc={amount}
          merchantWallet={merchantWallet}
          onSuccess={(hash) => {
            console.log('[SANDBOX] Success. Hash:', hash);
          }}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      ` }} />
    </main>
  );
}
