"use client";

import React from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

export default function UnifiedLanding() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-purple-500/30 relative">

      {/* Subtle bottom fade */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      {/* HEADER with Halo */}
      <header className="relative text-center mb-16 animate-in fade-in slide-in-from-top duration-700">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-20 bg-purple-600/20 blur-[3rem] rounded-full pointer-events-none" />

        <h1 className="relative text-5xl font-black italic uppercase tracking-tighter mb-2">
          Opayque
        </h1>
        <p className="relative text-[10px] text-zinc-500 uppercase tracking-[0.5em] font-bold">
          Shielded POS Infrastructure
        </p>

        <p className="relative text-xs text-zinc-600 mt-3">
          Secure merchant vault + shielded staff terminals
        </p>
      </header>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">

        {/* MERCHANT VAULT */}
        <div className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3rem]
                        hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(147,51,234,0.15)]
                        transition-all duration-500 overflow-hidden
                        animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl
                          group-hover:bg-purple-600/20 transition-all" />

          <h2 className="text-2xl font-black italic mb-4 uppercase">Merchant Vault</h2>
          <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
            Connect your authority wallet to manage staff, audit transactions, and settle funds to Mainnet.
          </p>

          {connected ? (
            <Link
              href="/admin"
              aria-label="Enter Merchant Dashboard"
              className="block w-full py-4 bg-purple-600 text-center rounded-2xl font-black uppercase text-xs tracking-widest
                         hover:bg-purple-500 transition-all shadow-[0_10px_30px_rgba(147,51,234,0.2)]
                         focus:outline-none focus:ring-4 focus:ring-purple-500/30"
            >
              Enter Dashboard
            </Link>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest opacity-50">
                Authentication Required
              </span>
              <WalletMultiButton
                className="!bg-white !text-black !rounded-2xl !font-black !text-[10px] !uppercase !tracking-widest
                           !h-14 !w-full flex justify-center hover:!bg-zinc-200 transition-colors"
              />
            </div>
          )}
        </div>

        {/* STAFF TERMINAL */}
        <Link
          href="/terminal"
          aria-label="Go to Staff Terminal"
          className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3rem]
                     hover:border-zinc-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]
                     transition-all duration-500
                     animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both
                     focus:outline-none focus:ring-4 focus:ring-purple-500/20"
        >
          <h2 className="text-2xl font-black italic mb-4 uppercase text-zinc-300 group-hover:text-white transition-colors">
            Staff Terminal
          </h2>
          <p className="text-zinc-500 text-sm mb-12 leading-relaxed">
            Pair this device using a merchant authorization code to start generating shielded payment requests.
          </p>

          <span
            role="button"
            className="block w-full py-4 bg-zinc-800 text-center rounded-2xl font-black uppercase text-xs tracking-widest
                       group-hover:bg-zinc-700 transition-all text-white"
          >
            Pair Device
          </span>
        </Link>
      </div>

      {/* FOOTER */}
      <footer className="mt-20 opacity-20 hover:opacity-50 transition-opacity animate-in fade-in duration-1000 delay-500 fill-mode-both">
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
