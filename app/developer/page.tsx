'use client';
/* eslint-disable react/jsx-no-comment-textnodes */

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Terminal,
  Key,
  BookOpen,
  Zap,
  Copy,
  Check,
  Code2,
  ArrowRight,
  X,
} from 'lucide-react';

export default function DeveloperPage() {
  const [showKeysModal, setShowKeysModal] = useState<boolean>(false);
  const [showQuickstartModal, setShowQuickstartModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [totalVolume, setTotalVolume] = useState<number | null>(null);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // Fetch merchant analytics and ensure authenticated session
  useEffect(() => {
    let mounted = true;
    (async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAnalyticsError('Unauthorized — please sign in');
          return;
        }

        const res = await fetch('/api/v1/merchant/analytics');
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || 'Failed to load analytics');
        }
        const payload = await res.json();
        if (!mounted) return;
        setTotalVolume(payload?.metrics?.totalVolume ?? 0);
        setTransactionCount(payload?.metrics?.transactionCount ?? 0);
        setRecentTransactions(payload?.recentTransactions ?? []);
      } catch (err: any) {
        console.error(err);
        if (mounted) setAnalyticsError(err?.message || 'Failed to load analytics');
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col font-mono selection:bg-[#00ffcc]/30 selection:text-[#00ffcc]">
      {/* ALWAYS-VISIBLE TOP HEADER NAV */}
      <header className="sticky top-0 z-40 border-b border-[#1f293d] bg-[#050508]/90 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#00ffcc]/20 to-purple-600/30 border border-[#00ffcc]/40 flex items-center justify-center text-[#00ffcc]">
            <Code2 className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-wider text-white">
            Opayque <span className="text-[#00ffcc]">//</span> <span className="text-gray-400 text-sm sm:text-base">Dev_Hub</span>
          </span>
        </div>
        {/* Recent Transactions */}
        <div className="mt-6">
          <h2 className="text-lg font-bold uppercase text-zinc-400 mb-3">Recent Transactions</h2>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50 p-4">
            {analyticsLoading ? (
              <div className="text-sm text-zinc-500">Loading transactions…</div>
            ) : analyticsError ? (
              <div className="text-sm text-red-400">{analyticsError}</div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-sm text-zinc-500">No recent transactions</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pr-4">Amount</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx: any) => (
                      <tr key={tx.id} className="border-t border-white/5">
                        <td className="py-3 pr-4 text-zinc-300">{tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</td>
                        <td className="py-3 pr-4 text-zinc-300">{tx.amount ?? '—'}</td>
                        <td className="py-3 pr-4 text-zinc-300">{tx.status ?? tx.state ?? '—'}</td>
                        <td className="py-3 pr-4 font-mono text-zinc-300">{tx.signature ?? tx.id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => setShowKeysModal(true)}
            className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#1f293d]/50 border border-[#00ffcc]/30 text-[#00ffcc] hover:bg-[#00ffcc]/10 hover:border-[#00ffcc] transition-all text-xs sm:text-sm font-semibold"
          >
            <Key className="w-4 h-4" />
            <span>API_KEYS</span>
          </button>

          <button
            onClick={() => setShowQuickstartModal(true)}
            className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 transition-all text-xs sm:text-sm font-semibold shadow-lg shadow-purple-900/20"
          >
            <Zap className="w-4 h-4" />
            <span>QUICKSTART</span>
          </button>
        </div>
      </header>

      {/* ALWAYS-RENDERED MAIN DASHBOARD WORKSPACE (STEP 3) */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Hub Title Header */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs uppercase tracking-widest text-purple-400 font-semibold">
            <Code2 className="w-4 h-4" />
            <span>Developer Integration</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold italic tracking-tight text-white uppercase">
            API & Protocol Hub
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-xl uppercase tracking-wider">
            Manage Opayque endpoints, RPC routing, and checkout sandboxes.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Production API Key Card */}
          <div className="p-6 rounded-3xl bg-[#0b0c10] border border-[#1f293d] space-y-6 flex flex-col justify-between hover:border-purple-500/40 transition-all">
            <div className="flex items-start space-x-4">
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold uppercase tracking-wide text-white">
                  Production API Key
                </h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Bearer Token Authentication
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#050508] border border-[#1f293d] flex items-center justify-between font-mono text-xs sm:text-sm text-purple-300">
              <div className="text-left">
                <div className="text-[11px] text-zinc-400">Total Volume</div>
                <div className="text-lg font-extrabold text-white">{analyticsLoading ? 'Loading…' : totalVolume !== null ? Number(totalVolume).toLocaleString() : '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-zinc-400">Transactions</div>
                <div className="text-lg font-extrabold text-white">{analyticsLoading ? '—' : transactionCount !== null ? transactionCount : '—'}</div>
              </div>
            </div>
          </div>

          {/* Solana RPC Config Card */}
          <div className="p-6 rounded-3xl bg-[#0b0c10] border border-purple-900/40 space-y-4 hover:border-purple-500/60 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-2xl bg-purple-950/40 text-purple-400 border border-purple-800/30">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold uppercase tracking-wide text-white">
                Solana RPC Config
              </h3>
              <p className="text-xs text-gray-400 tracking-wide leading-relaxed">
                Setup multi-provider RPC layer abstractions for resilient network settlement.
              </p>
            </div>
          </div>

          {/* Mobile Wallet Adapter Card */}
          <div className="p-6 rounded-3xl bg-[#0b0c10] border border-[#1f293d] space-y-4 hover:border-purple-500/40 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-2xl bg-gray-900 text-gray-300 border border-gray-800">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold uppercase tracking-wide text-white">
                Mobile Wallet Adapter
              </h3>
              <p className="text-xs text-gray-400 tracking-wide leading-relaxed">
                Deep-linking configurations and hardware terminal pairing payloads.
              </p>
            </div>
          </div>

          {/* Sandbox Environment Card */}
          <div className="p-6 rounded-3xl bg-[#0b0c10] border border-purple-600/50 space-y-6 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-3">
              <h3 className="text-lg font-extrabold uppercase tracking-wide text-purple-300">
                Sandbox Environment
              </h3>
              <p className="text-xs text-gray-400 tracking-wide leading-relaxed">
                Simulate the shielded checkout flow before pushing to mainnet. This utilizes your current testnet configurations.
              </p>
            </div>

            <Link
              href="/developer/sandbox"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold uppercase text-xs tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/30 hover:opacity-95 transition-all text-center"
            >
              <span>Launch Checkout Simulation</span>
            </Link>
          </div>
        </div>
      </main>


      {/* STEP 1 POP-UP MODAL: DEVELOPER ONBOARDING */}
      {step === 'onboarding' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-950/95 p-8 shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="pointer-events-none absolute inset-0 bg-purple-600/10" />
            <div className="relative mb-8 flex flex-col items-center text-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-purple-500/30 bg-purple-600/20 text-purple-300 shadow-[0_0_35px_rgba(168,85,247,0.2)]">
                <Terminal className="h-10 w-10" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Access control center</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tight text-white">Complete onboarding</h2>
              <p className="max-w-md text-sm text-zinc-400">Create your developer integration profile with payout wallet, webhook, contact details, and a secure control center password.</p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="relative space-y-4">
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project Name"
                className="w-full rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-purple-500/50"
              />
              <input
                type="text"
                required
                value={destinationWallet}
                onChange={(e) => setDestinationWallet(e.target.value)}
                placeholder="Payout Wallet Address"
                className={`w-full rounded-2xl border ${onboardingError?.toLowerCase().includes('wallet') ? 'border-red-500/50' : 'border-white/5'} bg-black/40 px-4 py-4 font-mono text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-purple-500/50`}
              />
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Webhook URL"
                className="w-full rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-purple-500/50"
              />
              <input
                type="text"
                required
                value={emailOrGithub}
                onChange={(e) => setEmailOrGithub(e.target.value)}
                placeholder="Email or GitHub"
                className="w-full rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-purple-500/50"
              />
              <input
                type="password"
                required
                value={controlPassword}
                onChange={(e) => setControlPassword(e.target.value)}
                placeholder="Control Center Password"
                className="w-full rounded-2xl border border-white/5 bg-black/40 px-4 py-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-purple-500/50"
              />

              {onboardingError && (
                <p className="px-2 text-[10px] font-bold uppercase tracking-tight text-red-400">{onboardingError}</p>
              )}

              <button
                type="submit"
                className="group relative w-full overflow-hidden rounded-2xl bg-purple-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-purple-500 active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">Save & Continue <ArrowRight className="h-4 w-4" /></span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              </button>
            </form>
          </div>
        {/* HEADER MODAL: API KEYS */}
      {showKeysModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0b0c10] border border-[#1f293d] rounded-3xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setShowKeysModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f293d]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-[#00ffcc]">
              <Key className="w-6 h-6" />
              <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                API Keys Management
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Live Production Key
                </label>
                <div className="p-3.5 rounded-xl bg-[#050508] border border-[#1f293d] flex items-center justify-between font-mono text-sm text-purple-300">
                  <span className="truncate mr-2">Create keys in the Keys tab</span>
                  <button disabled className="p-1.5 rounded-lg text-gray-600 flex-shrink-0" title="Copy API Key (disabled)">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Testnet Secret Key
                </label>
                <div className="p-3.5 rounded-xl bg-[#050508] border border-[#1f293d] flex items-center justify-between font-mono text-sm text-gray-500">
                  <span>Test keys available in Keys tab</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowKeysModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#1f293d] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#1f293d]/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER MODAL: QUICKSTART */}
      {showQuickstartModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0b0c10] border border-purple-500/40 rounded-3xl p-6 sm:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowQuickstartModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1f293d]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-purple-400">
              <Zap className="w-6 h-6" />
              <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                Developer Quickstart
              </h3>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="p-4 rounded-2xl bg-[#050508] border border-[#1f293d] space-y-2">
                <span className="text-xs font-bold text-[#00ffcc] uppercase tracking-wider">
                  1. Install SDK Package
                </span>
                <pre className="p-3 rounded-xl bg-black text-purple-300 font-mono text-xs overflow-x-auto">
                  npm install @opayque/sdk
                </pre>
              </div>

              <div className="p-4 rounded-2xl bg-[#050508] border border-[#1f293d] space-y-2">
                <span className="text-xs font-bold text-[#00ffcc] uppercase tracking-wider">
                  2. Instantiate Client
                </span>
                <pre className="p-3 rounded-xl bg-black text-[#00ffcc] font-mono text-xs overflow-x-auto leading-relaxed">
                  {`import { Opayque } from '@opayque/sdk';\n\nconst opayque = new Opayque({\n  apiKey: 'YOUR_API_KEY_HERE',\n  network: 'mainnet-beta'\n});`}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowQuickstartModal(false)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-purple-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
