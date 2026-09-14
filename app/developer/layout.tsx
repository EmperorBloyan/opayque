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
  ShieldCheck,
  Server,
  Camera,
} from "lucide-react";
import { useEnvironment } from "@/lib/context/EnvironmentContext";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide layout chrome on full-page app experiences that should render without the developer shell behind them
  const isPublicDocsPage = pathname === "/developer/docs" || pathname.startsWith("/developer/docs/");
  const isHiddenPage = pathname === "/developer/keys" || pathname === "/developer/sandbox" || isPublicDocsPage || pathname.includes("onboarding");

  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [merchantName, setMerchantName] = useState("Opayque Merchant");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);
  const [defaultTransferMode, setDefaultTransferMode] = useState<"private" | "public">("private");

  // Global Environment Context
  const { isSandbox, toggleEnvironment } = useEnvironment();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const localName =
      window.localStorage.getItem("merchant_name") ||
      window.localStorage.getItem("business_name");
    const localLogo =
      window.localStorage.getItem("merchant_logo") ||
      window.localStorage.getItem("merchant_avatar");
    const localTransferMode = window.localStorage.getItem("default_transfer_mode");

    if (localName) setMerchantName(localName);
    if (localLogo) setMerchantLogo(localLogo);
    if (localTransferMode === "public" || localTransferMode === "private") {
      setDefaultTransferMode(localTransferMode);
    }

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
        setDefaultTransferMode(merchant?.default_transfer_mode === "public" ? "public" : "private");
      } catch (error) {
        console.warn("Failed to load merchant profile", error);
      }
    };

    void fetchMerchantProfile();
  }, [pathname]); // refresh when navigating inside developer

  useEffect(() => {
    const handleProfileUpdate = () => {
      const localName = window.localStorage.getItem("merchant_name");
      const localLogo = window.localStorage.getItem("merchant_logo");
      const localTransferMode = window.localStorage.getItem("default_transfer_mode");
      if (localName) setMerchantName(localName);
      if (localLogo) setMerchantLogo(localLogo);
      if (localTransferMode === "public" || localTransferMode === "private") {
        setDefaultTransferMode(localTransferMode);
      }
    };

    window.addEventListener("storage", handleProfileUpdate);
    window.addEventListener("merchant_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("merchant_profile_updated", handleProfileUpdate);
    };
  }, []);

  const lockDeveloperHub = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black px-4 py-4 text-white selection:bg-purple-500/30 sm:px-6 sm:py-6">
      <div className="fixed inset-0 pointer-events-none bg-purple-500/5" />
      <div className="relative mx-auto max-w-6xl">
        {!isHiddenPage && (
          <>
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/5 pb-8 gap-6">
              <div className="flex items-center gap-5">
                <div className="relative group cursor-pointer">
                  <div className="h-16 w-16 rounded-full bg-zinc-900 border border-purple-500/20 flex items-center justify-center overflow-hidden transition-all shadow-inner">
                    {merchantLogo ? (
                      <img src={merchantLogo} alt={merchantName} className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={20} className="text-zinc-600" />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-white">
                      {merchantName}
                    </h1>
                    <button
                      type="button"
                      onClick={() => router.push("/developer/keys")}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 hover:shadow-[0_0_18px_rgba(168,85,247,0.35)]"
                      aria-label="Open developer keys"
                    >
                      <Key size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <nav className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-md md:w-auto md:gap-3">
                <Link
                  href="/developer/overview"
                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all sm:px-6 md:flex-none ${
                    pathname.startsWith("/developer/overview")
                      ? "bg-white text-black shadow-xl shadow-white/5"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LayoutDashboard size={14} /> Overview
                </Link>
                <Link
                  href="/developer/webhooks-delivery-logs"
                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all sm:px-6 md:flex-none ${
                    pathname.startsWith("/developer/webhooks-delivery-logs")
                      ? "bg-white text-black shadow-xl shadow-white/5"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Webhook size={14} /> Webhooks &amp; Delivery Logs
                </Link>
                <button
                  type="button"
                  onClick={lockDeveloperHub}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-purple-500/40 hover:text-white sm:px-4 md:ml-auto"
                >
                  <Lock size={14} /> Lock Hub
                </button>
              </nav>
            </header>

            <div className="mb-12 flex items-center justify-end px-4">
              <button
                type="button"
                onClick={toggleEnvironment}
                className="flex items-center gap-2"
                aria-label={`Switch to ${isSandbox ? "production" : "sandbox"} environment`}
              >
                {isSandbox ? (
                  <ShieldCheck size={16} className="text-emerald-400" />
                ) : (
                  <Server size={16} className="text-amber-400" />
                )}
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                  {isSandbox ? "Sandbox Mode (Devnet)" : "Production Mode (Mainnet)"}
                </span>
              </button>
            </div>
          </>
        )}

        <main>{children}</main>

        {!isHiddenPage && (
          <footer className="mt-20 flex items-center justify-between border-t border-white/5 pt-8 opacity-30">
            <p className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
              {defaultTransferMode === "private" ? "Powered by Solana TEE Infrastructure" : "Standard Transfer Session"}
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
            className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-purple-700/95 text-white shadow-[0_30px_70px_rgba(80,0,140,0.45)] transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {isSpeedDialOpen ? <X size={24} /> : <Wrench size={24} />}
          </button>
        </div>
      )}
    </div>
  );
}
