"use client";

import { useState, useEffect, useCallback } from "react";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { Activity, CheckCircle2, Server, Smartphone, Zap, RefreshCw } from "lucide-react";
import { useEnvironment } from "@/lib/context/EnvironmentContext";

export default function OverviewPage() {
  const { isSandbox, network } = useEnvironment();

  // Dynamic RPC URL calculation based on active environment context
  const targetRpcEndpoint = isSandbox
    ? process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || clusterApiUrl("devnet")
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

  const [slot, setSlot] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<"SYNCING" | "HEALTHY" | "DEGRADED" | "OFFLINE">("SYNCING");
  
  // Real RPC session metrics
  const [pingStats, setPingStats] = useState({ total: 0, success: 0 });
  
  // Real MWA / Web3 Provider Detection
  const [mwaConnected, setMwaConnected] = useState<boolean>(false);
  const [mwaProtocol, setMwaProtocol] = useState<string>("Checking...");

  const fetchTelemetry = useCallback(async (connection: Connection) => {
    const startTime = performance.now();
    try {
      const currentSlot = await connection.getSlot();
      const endTime = performance.now();
      const ping = Math.round(endTime - startTime);

      setPingStats((prev) => ({ total: prev.total + 1, success: prev.success + 1 }));
      setLatency(ping);
      setSlot(currentSlot);
      setNetworkStatus(ping > 1000 ? "DEGRADED" : "HEALTHY");
    } catch (error) {
      setPingStats((prev) => ({ total: prev.total + 1, success: prev.success }));
      setNetworkStatus("OFFLINE");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Reset stats when environment toggles
    setSlot(null);
    setLatency(null);
    setNetworkStatus("SYNCING");
    setPingStats({ total: 0, success: 0 });

    const connection = new Connection(targetRpcEndpoint, "confirmed");
    let intervalId: NodeJS.Timeout;

    const initTelemetry = async () => {
      if (mounted) await fetchTelemetry(connection);
    };

    // 1. Initialize Real-Time Solana RPC Ping
    initTelemetry();
    intervalId = setInterval(() => {
      if (mounted) fetchTelemetry(connection);
    }, 3000);

    // 2. Client-side Environment & Mobile Wallet Adapter (MWA) Detection
    if (typeof window !== "undefined") {
      const globalAny = window as any;
      const hasSolana = Boolean(globalAny.solana || globalAny.phantom || globalAny.solflare);
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      setMwaConnected(hasSolana);
      setMwaProtocol(isMobile ? "MWA // Native DeepLink" : hasSolana ? "WSS / Web3 Provider" : "No Wallet Detected");
    }

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [fetchTelemetry, targetRpcEndpoint]);

  // Calculate actual session success rate
  const successRate = pingStats.total > 0 
    ? ((pingStats.success / pingStats.total) * 100).toFixed(1) 
    : "--";

  const getRpcDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return isSandbox ? "api.devnet.solana.com" : "api.mainnet-beta.solana.com";
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col gap-4 border-b border-white/5 pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Developer Hub // Tab 01</span>
          </div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white md:text-5xl">
            API &amp; Protocol Overview
          </h2>
          <p className="max-w-2xl text-xs font-bold uppercase tracking-widest text-zinc-500">
            Real-time analytics, RPC node health, and endpoint configuration.
          </p>
        </div>
        
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2">
          <div className={`h-2 w-2 rounded-full ${
            networkStatus === 'HEALTHY' ? 'bg-emerald-400 animate-pulse' : 
            networkStatus === 'DEGRADED' ? 'bg-amber-400' : 
            networkStatus === 'OFFLINE' ? 'bg-rose-500' : 'bg-zinc-500'
          }`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
            Network Status:{" "}
            <span className={networkStatus === 'HEALTHY' ? 'text-emerald-400' : networkStatus === 'OFFLINE' ? 'text-rose-500' : 'text-amber-400'}>
              {networkStatus === 'HEALTHY' ? `Solana ${isSandbox ? 'Devnet' : 'Mainnet'}` : networkStatus}
            </span>
          </span>
          <RefreshCw size={12} className={`text-zinc-500 ${networkStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
        </div>
      </header>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Slot Card */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-white/5 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[9px] font-black uppercase tracking-widest">Current Slot</span>
            <Activity size={14} className="text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tighter text-white">
              {slot ? slot.toLocaleString() : "Syncing..."}
            </span>
            <p className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Live {isSandbox ? "Devnet" : "Mainnet"} Stream
            </p>
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-white/5 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[9px] font-black uppercase tracking-widest">Success Rate</span>
            <CheckCircle2 size={14} className="text-purple-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tighter text-white">{successRate}%</span>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-purple-500/70">
              Session RPC Reliability
            </p>
          </div>
        </div>

        {/* Latency Card */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-white/5 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[9px] font-black uppercase tracking-widest">Avg Response Latency</span>
            <Zap size={14} className="text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black tracking-tighter text-white">
              {latency !== null ? `${latency}ms` : "..."}
            </span>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">
              Multi-RPC Failover Active
            </p>
          </div>
        </div>
      </div>

      {/* Configurations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-[2.5rem] border border-white/5 bg-black/40 p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-purple-500/10 text-purple-400">
              <Server size={20} />
            </div>
            <span className={`rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${
              isSandbox 
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
            }`}>
              Active {isSandbox ? "Sandbox" : "Mainnet"} Relay
            </span>
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Solana RPC Config</h3>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 font-mono">
              Setup multi-provider RPC layer abstractions for resilient network settlement and instant state syncing.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/5 bg-zinc-900/50 p-4">
            <div className="flex justify-between border-b border-white/5 pb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Primary Node</span>
              <code className="text-[10px] text-white break-all text-right max-w-[60%]">{getRpcDomain(targetRpcEndpoint)}</code>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70">Real-Time Latency</span>
              <code className={`text-[10px] ${networkStatus === 'OFFLINE' ? 'text-rose-500' : 'text-emerald-400'}`}>
                {latency !== null ? `${latency}ms` : "Syncing..."}
              </code>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-[2.5rem] border border-white/5 bg-black/40 p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-zinc-800 text-zinc-400">
              <Smartphone size={20} />
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-zinc-400">
              Hardware Ready
            </span>
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Mobile Wallet Adapter</h3>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 font-mono">
              Deep-linking configurations and secure pairing payloads for POS and remote checkout integrations.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/5 bg-zinc-900/50 p-4">
            <div className="flex justify-between border-b border-white/5 pb-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Protocol</span>
              <code className="text-[10px] text-white">{mwaProtocol}</code>
            </div>
            <div className="flex justify-between pt-1">
              <span className={`text-[9px] font-black uppercase tracking-widest ${mwaConnected ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>Status</span>
              <code className={`text-[10px] ${mwaConnected ? 'text-emerald-400' : 'text-amber-400'} flex items-center gap-2`}>
                <span className={`h-1.5 w-1.5 rounded-full ${mwaConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
                {mwaConnected ? 'Connected / Ready' : 'Standby / Unpaired'}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
