"use client";

import { useState, useEffect, useCallback } from "react";
import { Connection } from "@solana/web3.js";
import { Activity, CheckCircle2, Server, Smartphone, Zap, RefreshCw } from "lucide-react";
import { useEnvironment } from "@/context/EnvironmentContext"; // Adjust import path as needed

export default function OverviewPage() {
  const { rpcEndpoint, network, isSandbox } = useEnvironment();

  const [slot, setSlot] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<"SYNCING" | "HEALTHY" | "DEGRADED" | "OFFLINE">("SYNCING");
  
  // Track actual RPC session requests and successes
  const [pingStats, setPingStats] = useState({ total: 0, success: 0 });
  
  // Mobile Wallet Adapter (MWA) & Web3 Provider Detection
  const [mwaConnected, setMwaConnected] = useState<boolean>(false);
  const [mwaProtocol, setMwaProtocol] = useState<string>("Checking...");

  // Reset telemetry stats on environment switch
  useEffect(() => {
    setPingStats({ total: 0, success: 0 });
    setSlot(null);
    setLatency(null);
    setNetworkStatus("SYNCING");
  }, [rpcEndpoint]);

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
    const connection = new Connection(rpcEndpoint, "confirmed");

    const initTelemetry = async () => {
      if (mounted) await fetchTelemetry(connection);
    };

    initTelemetry();
    const intervalId = setInterval(() => {
      if (mounted) fetchTelemetry(connection);
    }, 3000);

    // Wallet / MWA Detection
    if (typeof window !== "undefined") {
      const globalAny = window as any;
      const hasSolana = Boolean(globalAny.solana || globalAny.phantom || globalAny.solflare);
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      setMwaConnected(hasSolana);
      setMwaProtocol(
        isMobile ? "MWA // Native DeepLink" : hasSolana ? "WSS / Web3 Provider" : "No Wallet Detected"
      );
    }

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [rpcEndpoint, fetchTelemetry]);

  const successRate = pingStats.total > 0 
    ? ((pingStats.success / pingStats.total) * 100).toFixed(1) 
    : "--";

  const getRpcDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return rpcEndpoint;
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col gap-4 border-b border-white/5 pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                networkStatus === "HEALTHY" ? "bg-emerald-400" : networkStatus === "DEGRADED" ? "bg-yellow-400" : "bg-red-400"
              }`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${
                networkStatus === "HEALTHY" ? "bg-emerald-500" : networkStatus === "DEGRADED" ? "bg-yellow-500" : "bg-red-500"
              }`} />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase">
              {network} — {networkStatus}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">System Telemetry</h1>
        </div>

        {/* Dynamic RPC Badge */}
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 backdrop-blur-sm">
          <Server className="h-4 w-4 text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">Connected Node</span>
            <span className="font-mono text-white">{getRpcDomain(rpcEndpoint)}</span>
          </div>
        </div>
      </header>

      {/* Telemetry Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Current Slot */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Current Slot</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-4 font-mono text-2xl font-bold text-white">
            {slot !== null ? slot.toLocaleString() : "Syncing..."}
          </p>
        </div>

        {/* RPC Latency */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Latency</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-4 font-mono text-2xl font-bold text-white">
            {latency !== null ? `${latency} ms` : "--"}
          </p>
        </div>

        {/* Request Success Rate */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Ping Success</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-4 font-mono text-2xl font-bold text-white">
            {successRate}%
          </p>
        </div>

        {/* Wallet / MWA Status */}
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Provider / MWA</span>
            <Smartphone className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-white truncate">
            {mwaProtocol}
          </p>
        </div>
      </div>
    </div>
  );
}
