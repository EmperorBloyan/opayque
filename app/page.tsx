"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

// Dynamic import for wallet button
const WalletMultiButtonNoSSR = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-14 w-full bg-zinc-800/20 animate-pulse rounded-2xl" aria-hidden="true" />
    ),
  }
);

export default function UnifiedLanding() {
  const [mounted, setMounted] = useState(false);
  const { connected } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-purple-500/30 relative">
      {/* HEADER */}
      <header className="text-center mb-16">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">Opayque</h1>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.5em] font-bold">
          Shielded POS Infrastructure
        </p>
        <p className="text-xs text-zinc-600 mt-3">
          Secure merchant vault + shielded staff terminals
        </p>
      </header>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* MERCHANT VAULT */}
        <div className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3rem]">
          <h2 className="text-2xl font-black italic mb-4 uppercase">Merchant Vault</h2>
          <p className="text-zinc-500 text-sm mb-8">
            Connect your wallet to manage staff, audit transactions, and settle funds to Mainnet.
          </p>

          {mounted ? (
            connected ? (
              <Link
                href="/vault/dashboard"
                aria-label="Enter Merchant Dashboard"
                className="block w-full py-4 bg-purple-600 text-center rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition-all"
              >
                Enter Dashboard
              </Link>
            ) : (
              <WalletMultiButtonNoSSR className="!bg-white !text-black !rounded-2xl !font-black !text-[10px] !uppercase !tracking-widest !h-14 !w-full flex justify-center hover:!bg-zinc-200 transition-colors" />
            )
          ) : (
            <div className="h-14 w-full" aria-hidden />
          )}
        </div>

        {/* STAFF TERMINAL */}
        <Link
          href="/terminal"
          aria-label="Go to Staff Terminal"
          className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3rem]"
        >
          <h2 className="text-2xl font-black italic mb-4 uppercase text-zinc-300 group-hover:text-white">
            Staff Terminal
          </h2>
          <p className="text-zinc-500 text-sm mb-12">
            Pair your device for secure access.
          </p>
          <span className="block w-full py-4 bg-zinc-800 text-center rounded-2xl font-black uppercase text-xs tracking-widest text-white">
            Open Terminal
          </span>
        </Link>
      </div>

      {/* FOOTER */}
      <footer className="mt-20 opacity-20 hover:opacity-50 transition-opacity">
        <a
          href="https://solana.com/radar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-mono uppercase tracking-widest hover:underline"
        >
          Built for Solana Radar 2026
        </a>
      </footer>
    </div>
  );
}