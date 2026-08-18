"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { createClient } from "@/lib/supabase/client";
import { clearActiveSession } from "@/lib/crypto/session";
import {
  LucideLayoutDashboard,
  LucideSettings2,
  LucideCamera,
  LucideShieldCheck,
  LucideShieldAlert,
  LucidePencilLine,
  Lock,
} from "lucide-react";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const isStandaloneCheckout = pathname === "/vault/checkout";

  const [merchantName, setMerchantName] = useState("Opayque");
  const [logo, setLogo] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState("Opayque");
  const [draftLogo, setDraftLogo] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    const savedLogo = localStorage.getItem("merchant_logo");
    const savedName = localStorage.getItem("merchant_name");

    if (savedLogo) {
      setLogo(savedLogo);
      setDraftLogo(savedLogo);
    }

    if (savedName) {
      setMerchantName(savedName);
      setDraftName(savedName);
    }

    const hydrateMerchantProfile = async () => {
      try {
        const res = await fetch("/api/v1/merchant");
        if (!res.ok) return;

        const payload = await res.json();
        const merchant = payload?.merchant;
        if (!merchant) return;

        if (merchant.merchant_name) {
          const name = merchant.merchant_name;
          setMerchantName(name);
          setDraftName(name);
          localStorage.setItem("merchant_name", name);
        }

        if (merchant.merchant_logo) {
          const logoUrl = merchant.merchant_logo;
          setLogo(logoUrl);
          setDraftLogo(logoUrl);
          localStorage.setItem("merchant_logo", logoUrl);
        }
      } catch (error) {
        console.warn("Failed to hydrate vault merchant profile", error);
      }
    };

    void hydrateMerchantProfile();
  }, []);

  // Listen for local storage updates and custom events to sync profile state globally
  useEffect(() => {
    const handleProfileUpdate = () => {
      const localName = window.localStorage.getItem("merchant_name");
      const localLogo = window.localStorage.getItem("merchant_logo");
      if (localName) {
        setMerchantName(localName);
        setDraftName(localName);
      }
      if (localLogo) {
        setLogo(localLogo);
        setDraftLogo(localLogo);
      }
    };

    window.addEventListener("storage", handleProfileUpdate);
    window.addEventListener("merchant_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("merchant_profile_updated", handleProfileUpdate);
    };
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setDraftLogo(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    const nextName = draftName.trim() || "Opayque";
    const nextLogo = draftLogo ?? logo;

    setMerchantName(nextName);
    setLogo(nextLogo);
    localStorage.setItem("merchant_name", nextName);

    if (nextLogo) {
      localStorage.setItem("merchant_logo", nextLogo);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("merchant_profile_updated"));
    }

    if (publicKey) {
      try {
        await fetch("/api/merchant/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_address: publicKey.toBase58(),
            merchant_name: nextName,
            merchant_logo: nextLogo ?? null,
          }),
        });
      } catch (error) {
        console.warn("Unable to sync merchant profile to the registry", error);
      }
    }

    setIsEditingProfile(false);
  };

  const handleVaultEntrance = () => {
    const glow = document.getElementById("vault-glow");
    if (glow) {
      glow.classList.add("animate-pulse");
      setTimeout(() => {
        glow.classList.remove("animate-pulse");
      }, 1200);
    }
  };

  useEffect(() => {
    handleVaultEntrance();
  }, []);

  const handleLockHub = async () => {
    if (isLocking) return;
    setIsLocking(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Supabase sign-out failed during vault lock", error);
    }

    clearActiveSession();

    if (typeof window !== "undefined") {
      window.localStorage.setItem("opayque_next_route", "/vault/registry");
      window.localStorage.removeItem("merchant_name");
      window.localStorage.removeItem("merchant_logo");
      window.localStorage.removeItem("merchant_email");
    }

    router.push("/login?next=%2Fvault%2Fregistry");
  };

  const addressContent = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "Not Connected";

  if (isStandaloneCheckout) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 selection:bg-purple-500/30">
      <div
        id="vault-glow"
        className="fixed inset-0 bg-purple-500/5 pointer-events-none transition-all duration-500"
      />

      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/5 pb-8 gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-purple-500/20 flex items-center justify-center overflow-hidden transition-all shadow-inner">
                {logo ? (
                  <img
                    src={logo}
                    alt="Merchant Brand Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <LucideCamera size={20} className="text-zinc-600" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white">
                  {merchantName}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(merchantName);
                    setDraftLogo(logo);
                    setIsEditingProfile(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 hover:shadow-[0_0_18px_rgba(168,85,247,0.35)]"
                  aria-label="Edit merchant profile"
                >
                  <LucidePencilLine size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-2">
                {connected ? (
                  <LucideShieldCheck size={12} className="text-green-500" />
                ) : (
                  <LucideShieldAlert size={12} className="text-zinc-600" />
                )}
                <p className="text-zinc-500 text-[9px] uppercase tracking-[0.2em] font-bold">
                  Vault ID:{" "}
                  <span className="font-mono text-zinc-400">{addressContent}</span>
                </p>
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3 bg-zinc-900/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            <Link
              href="/vault/dashboard"
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                pathname.startsWith("/vault/dashboard")
                  ? "bg-white text-black shadow-xl shadow-white/5"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <LucideLayoutDashboard size={14} /> Dashboard
            </Link>

            <Link
              href="/vault/registry"
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                pathname.startsWith("/vault/registry")
                  ? "bg-white text-black shadow-xl shadow-white/5"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <LucideSettings2 size={14} /> Registry
            </Link>

            <button
              type="button"
              onClick={() => void handleLockHub()}
              disabled={isLocking}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-purple-500/40 hover:text-white disabled:opacity-50"
            >
              <Lock size={14} />
              {isLocking ? "Locking..." : "Lock Hub"}
            </button>
          </nav>
        </header>

        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 py-8 md:items-center md:py-0">
            <div className="w-full max-w-xl rounded-[2.5rem] border border-white/10 bg-zinc-950/95 p-8 shadow-[0_0_25px_rgba(168,85,247,0.45)] ring-1 ring-white/10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">
                    Edit Merchant Profile
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-white">
                    Profile settings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <label className="text-sm uppercase tracking-[0.35em] text-zinc-500">
                    Avatar
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full border border-white/10 bg-gradient-to-br from-violet-700 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,0.35)] overflow-hidden flex items-center justify-center text-2xl font-black text-white">
                      {draftLogo ? (
                        <img
                          src={draftLogo}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <LucideCamera size={18} />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-violet-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <label className="text-sm uppercase tracking-[0.35em] text-zinc-500">
                    Merchant name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-[1.8rem] border border-white/10 bg-zinc-900/70 px-5 py-4 text-lg font-bold text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  className="inline-flex w-full justify-center rounded-[1.8rem] bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] transition hover:bg-purple-500 hover:brightness-110"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="relative">{children}</main>

        <footer className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center opacity-30">
          <p className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
            Powered by Solana TEE Infrastructure
          </p>
          <div className="flex gap-4">
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                connected ? "bg-green-500 animate-pulse" : "bg-zinc-700"
              }`}
            />
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                connected ? "bg-purple-500" : "bg-zinc-700"
              }`}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
