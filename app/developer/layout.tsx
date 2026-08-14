"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Key,
  Lock,
  X,
  Zap,
  Wrench,
  LayoutDashboard,
  Webhook,
  Globe,
  Building2
} from "lucide-react";
import { clearActiveSession } from "@/lib/crypto/session";
import { useEnvironment } from "@/lib/context/EnvironmentContext";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide layout chrome only on keys and onboarding pages
  const isHiddenPage = pathname === "/developer/keys" || pathname.includes("onboarding");

  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [merchantName, setMerchantName] = useState("Opayque Merchant");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);

  // Global Environment Context
  const { isSandbox, toggleEnvironment } = useEnvironment();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Instantly populate from local storage to eliminate UI flicker
    const localName = window.localStorage.getItem("merchant_name") || window.localStorage.getItem("business_name");
    const localLogo = window.localStorage.getItem("merchant_logo") || window.localStorage.getItem("merchant_avatar");

    if (localName) setMerchantName(localName);
    if (localLogo) setMerchantLogo(localLogo);

    // 2. Fetch fresh profile in background
    const fetchMerchantProfile = async () => {
      try {
        const res = await fetch("/api/v1/merchant");
        if (!res.ok) return;
        const payload = await res.json();
        const merchant = payload?.merchant;

        if (merchant?.merchant_name) {
          setMerchantName(merchant.merchant_name);
          window.localStorage.setItem("merchant_name", merchant.merchant_name);
        }

        if (merchant?.merchant_logo) {
          setMerchantLogo(merchant.merchant_logo);
          window.localStorage.setItem("merchant_logo", merchant.merchant_logo);
        }
      } catch (error) {
        console.warn("Failed to load merchant profile", error);
      }
    };

    void fetchMerchantProfile();
  }, []);

  // Sync state when profile is updated from modal/forms
  useEffect(() => {
    const handleProfileUpdate = () => {
      const localName = window.localStorage.getItem("merchant_name");
      if (localName) setMerchantName(localName);
    };

    window.addEventListener("storage", handleProfileUpdate);
    window.addEventListener("merchant_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("merchant_profile_updated", handleProfileUpdate);
    };
  }, []);

  const lockDeveloperHub = () => {
    clearActiveSession();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-black px-6 py-6 text-white selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none bg-purple-500/5" />
      <div className="relative mx-auto max-w-6xl">
        {!isHiddenPage && (
          <>
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/5 pb-8 gap-6">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-purple-500/30 flex items-center justify-center overflow-hidden shadow-inner">
                    {merchantLogo ? (
                      <img src={merchantLogo} alt={merchantName} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 size={28} className="text-purple-400" />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-white">
                        {merchantName}
                      </h1>
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Developer session active
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/developer/keys")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-purple-500/40 hover:text-white"
                    >
                      <Key size={14} /> API Keys &amp; Merchant Details
                    </button>
                  </div>
                </div>
              </div>

              {/* UNIFIED ENVIRONMENT SELECTOR */}
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.28em] ${
                    isSandbox
                      ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-600/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {isSandbox ? "Sandbox Mode (Devnet)" : "Production Mode (Mainnet)"}
                </div>

                <button
                  type="button"
                  onClick={toggleEnvironment}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white transition hover:border-purple-500/40 hover:bg-purple-500/10"
                >
                  <Globe size={14} className="text-purple-400" />
                  <span>Switch to {isSandbox ? "Mainnet" : "Devnet"}</span>
                </button>

                <button
                  type="button"
                  onClick={lockDeveloperHub}
                  className="group flex items-center gap-2 rounded-2xl border border-white/5 bg-zinc-900/80 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 transition hover:text-red-500"
                >
                  <Lock size={14} className="group-hover:animate-pulse" /> Lock Hub
                </button>
              </div>
            </header>

            {/* NAVIGATION BAR */}
            <nav className="mb-10 flex w-full overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-md">
              <Link
                href="/developer/overview"
                className={`flex min-w-fit items-center gap-2 rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  pathname.startsWith("/developer/overview")
                    ? "bg-white text-black shadow-xl shadow-white/5"
                    : "text-zinc-500 hover:bg-white/5 hover:text-white"
                }`}
              >
                <LayoutDashboard size={14} /> Overview
              </Link>
              <Link
                href="/developer/webhooks-delivery-logs"
                className={`flex min-w-fit items-center gap-2 rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  pathname.startsWith("/developer/webhooks-delivery-logs")
                    ? "bg-white text-black shadow-xl shadow-white/5"
                    : "text-zinc-500 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Webhook size={14} /> Webhooks &amp; Delivery Logs
              </Link>
            </nav>
          </>
        )}

        <main>{children}</main>

        {!isHiddenPage && (
          <footer className="mt-20 flex items-center justify-between border-t border-white/5 pt-8 opacity-30">
            <p className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
              Powered by Solana TEE Infrastructure
            </p>
            <div className="flex gap-4">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
          </footer>
        )}
      </div>

      {!isHiddenPage && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          <div
            className={`flex flex-col items-end gap-3 overflow-hidden transition-[max-height,opacity] duration-300 ${
              isSpeedDialOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <Link
              href="/sandbox"
              onClick={() => setIsSpeedDialOpen(false)}
              className="group flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-[0_15px_40px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:border-purple-500/40 hover:bg-white/5 active:scale-[0.98]"
            >
              <span>Sandbox</span>
              <Zap size={16} className="text-purple-400" />
            </Link>

            <Link
              href="/quickstart"
              onClick={() => setIsSpeedDialOpen(false)}
              className="group flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-purple-700/95 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-[0_15px_40px_rgba(80,0,140,0.35)] transition-all hover:-translate-y-0.5 hover:border-purple-300/50 hover:bg-purple-600/90 active:scale-[0.98]"
            >
              <span>Quickstart</span>
              <Key size={16} className="text-white" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsSpeedDialOpen((current) => !current)}
            aria-expanded={isSpeedDialOpen}
            aria-label="Toggle developer quick actions"
            className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/90 text-white shadow-[0_30px_70px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {isSpeedDialOpen ? <X size={24} /> : <Wrench size={24} />}
          </button>
        </div>
      )}
    </div>
  );
}
