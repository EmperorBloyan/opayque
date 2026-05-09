"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { LucideShieldCheck, LucideLoader2, LucideLock, LucideMonitorSmartphone } from "lucide-react";

const WalletMultiButtonNoSSR = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  {
    ssr: false,
    loading: () => <div className="h-14 w-full bg-zinc-800/20 animate-pulse rounded-2xl" />,
  }
);

export default function UnifiedLanding() {
  const [mounted, setMounted] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const { connected, publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 10. THE AUTHORIZATION CEREMONY (Reduced to 1.2s)
  const handleVaultEntrance = () => {
    setIsAuthorizing(true);
    // Timing synced with Registry Page for seamless transition
    setTimeout(() => {
      router.push("/vault/registry");
    }, 1200);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* 10. BACKGROUND GLOW (Synced to 1.2s logic) */}
      {isAuthorizing && (
        <div className="absolute inset-0 bg-purple-600/15 animate-pulse duration-400 z-0" />
      )}

      {isAuthorizing ? (
        <div className="z-20 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 rounded-full border border-purple-500/30 flex items-center justify-center mb-8 relative">
            {/* Pulsing rings synced to 3-cycle duration */}
            <div className="absolute inset-0 rounded-full border-2 border-purple-500 animate-ping opacity-20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin duration-700" />
            <LucideShieldCheck size={32} className="text-purple-500" />
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Merchant Authorization</h2>
          <div className="flex items-center gap-3 text-zinc-500">
            <LucideLoader2 size={14} className="animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Verifying Shielded Identity...</p>
          </div>
        </div>
      ) : (
        <div className="z-10 w-full max-w-4xl animate-in fade-in duration-700">
          <header className="text-center mb-16">
            <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2">Opayque</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.5em] font-bold">
              Shielded POS Infrastructure
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3.5rem] transition-all hover:border-purple-500/30 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-black italic uppercase">Merchant Vault</h2>
                <LucideLock className="text-zinc-700" size={20} />
              </div>
              <p className="text-zinc-500 text-sm mb-12 h-12">
                Manage staff, pair terminals, and audit transactions via TEE-shielded protocols.
              </p>

              {connected ? (
                <button
                  onClick={handleVaultEntrance}
                  className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition-all active:scale-[0.98]"
                >
                  Enter Secured Vault
                </button>
              ) : (
                <div className="p-1 bg-gradient-to-b from-white/10 to-transparent rounded-2xl">
                  <WalletMultiButtonNoSSR className="!bg-white !text-black !rounded-xl !font-black !text-[10px] !uppercase !tracking-widest !h-14 !w-full flex justify-center hover:!bg-zinc-200" />
                </div>
              )}
            </div>

            <Link
              href="/terminal"
              className="group relative bg-zinc-900/50 border border-white/5 p-10 rounded-[3.5rem] transition-all hover:bg-zinc-900 hover:border-white/10"
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-black italic uppercase text-zinc-400 group-hover:text-white transition-colors">
                  Staff Terminal
                </h2>
                <LucideMonitorSmartphone className="text-zinc-700" size={20} />
              </div>
              <p className="text-zinc-500 text-sm mb-12 h-12">
                Launch the hardware interface for point-of-sale operations.
              </p>
              <span className="block w-full py-5 bg-zinc-800 text-white text-center rounded-2xl font-black uppercase text-xs tracking-widest group-hover:bg-zinc-700 transition-all">
                Open Terminal
              </span>
            </Link>
          </div>
        </div>
      )}

      <footer className="absolute bottom-10 opacity-20">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-500">Global Settlement Layer</span>
          <p className="text-[9px] font-mono uppercase tracking-widest">Built for Solana Radar 2026</p>
        </div>
      </footer>

      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none opacity-10" />
    </div>
  );
}
