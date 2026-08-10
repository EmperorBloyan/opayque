'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Code2,
  Key,
  BookOpen,
  Terminal,
  Activity,
  CheckCircle2,
  TrendingUp,
  Zap,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export default function DeveloperOverviewPage() {
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);

  const mockApiKey = 'opq_live_9x8f7d6e5c4b3a210';

  const handleCopyKey = () => {
    navigator.clipboard.writeText(mockApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8 font-mono text-white">
      {/* SECTION TITLE & LIVE STATUS HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1f293d] pb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs uppercase tracking-widest text-[#00ffcc] font-semibold">
            <Code2 className="w-4 h-4" />
            <span>Developer Hub // Tab 01</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold italic tracking-tight uppercase text-white">
            API & Protocol Overview
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider">
            Real-time analytics, RPC node health, and endpoint configuration.
          </p>
        </div>

        {/* System Health Badge */}
        <div className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-[#0b0c10] border border-[#00ffcc]/30 w-fit">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ffcc] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ffcc]"></span>
          </span>
          <div className="text-xs">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Network Status</span>
            <span className="text-[#00ffcc] font-extrabold uppercase tracking-wider">Operational // Mainnet</span>
          </div>
        </div>
      </div>

      {/* API MONITORING & ANALYTICS METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Total API Requests */}
        <div className="p-5 rounded-2xl bg-[#0b0c10] border border-[#1f293d] space-y-2 hover:border-[#00ffcc]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
            <span>Requests Today</span>
            <Activity className="w-4 h-4 text-[#00ffcc]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">142,850</div>
          <div className="flex items-center space-x-1 text-[11px] text-[#00ffcc]">
            <TrendingUp className="w-3 h-3" />
            <span>+12.4% vs yesterday</span>
          </div>
        </div>

        {/* Metric 2: Settlement Success Rate */}
        <div className="p-5 rounded-2xl bg-[#0b0c10] border border-[#1f293d] space-y-2 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
            <span>Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">99.8%</div>
          <div className="text-[11px] text-purple-400 tracking-wider">
            <span>0.02% dropped packets</span>
          </div>
        </div>

        {/* Metric 3: Average Latency */}
        <div className="p-5 rounded-2xl bg-[#0b0c10] border border-[#1f293d] space-y-2 hover:border-[#00ffcc]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
            <span>Avg Response Latency</span>
            <Zap className="w-4 h-4 text-[#00ffcc]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">120ms</div>
          <div className="text-[11px] text-[#00ffcc] tracking-wider">
            <span>Multi-RPC Failover Active</span>
          </div>
        </div>
      </div>

      {/* CORE DEVELOPER WORKSPACE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Solana RPC Config Card */}
        <div className="p-8 rounded-[3rem] bg-zinc-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] hover:border-purple-500/40 transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-3xl bg-purple-950/40 text-purple-400 border border-purple-800/30">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-3 py-1 rounded-full bg-[#111118] text-emerald-400 border border-emerald-800/50 font-black uppercase tracking-[0.3em]">
                Active Relay
              </span>
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">
              Solana RPC Config
            </h3>
            <p className="text-sm text-zinc-400 tracking-wide leading-relaxed">
              Setup multi-provider RPC layer abstractions for resilient network settlement and instant state syncing.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm text-purple-200">
            <div className="flex items-center justify-between gap-4">
              <span className="uppercase tracking-[0.35em] text-zinc-500">Primary Node</span>
              <span className="font-black text-white">rpc.opayque.sol</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.35em] text-[#00ffcc]">
              <span>Latency</span>
              <span>24ms</span>
            </div>
          </div>
        </div>

        {/* Mobile Wallet Adapter Card */}
        <div className="p-8 rounded-[3rem] bg-zinc-900 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.3)] hover:border-purple-500/40 transition-all flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-3xl bg-zinc-800 text-zinc-200 border border-white/10">
                <Terminal className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-3 py-1 rounded-full bg-[#111118] text-[#a3a3ff] border border-[#5b4dff]/20 font-black uppercase tracking-[0.3em]">
                Hardware Ready
              </span>
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">
              Mobile Wallet Adapter
            </h3>
            <p className="text-sm text-zinc-400 tracking-wide leading-relaxed">
              Deep-linking configurations and secure pairing payloads for POS and remote checkout integrations.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-4">
              <span className="uppercase tracking-[0.35em] text-zinc-500">Protocol</span>
              <span className="font-black text-white">WSS</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.35em] text-emerald-400">
              <span>Status</span>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
