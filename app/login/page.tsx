"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bindAuthenticatedMerchantSession } from "@/lib/crypto/session";
import { ArrowRight, Lock, Mail, X, UserPlus } from "lucide-react";

function getSavedMerchantName() {
  if (typeof window === "undefined") return "Opayque Merchant";
  const merchantName = window.localStorage.getItem("merchant_name")?.trim();
  return merchantName || "Opayque Merchant";
}

function getSavedMerchantLogo() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("merchant_logo")?.trim() || window.localStorage.getItem("merchant_avatar")?.trim() || null;
}

function getRedirectTarget(defaultTarget: string) {
  if (typeof window === "undefined") return defaultTarget;

  const params = new URLSearchParams(window.location.search);
  const paramTarget = params.get("next")?.trim();
  const storedTarget = window.localStorage.getItem("opayque_next_route")?.trim();

  const candidate = paramTarget || storedTarget || defaultTarget;
  if (candidate.startsWith("/")) return candidate;

  return defaultTarget;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [merchantName, setMerchantName] = useState("Opayque Merchant");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMerchantName(getSavedMerchantName());
    setMerchantLogo(getSavedMerchantLogo());
  }, []);

  const infoText = useMemo(
    () => "Enter your company password to unlock the developer hub and continue managing your merchant session.",
    []
  );

  const goToDestination = (path: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(path);
    // Reset after brief delay to allow for re-attempts if navigation fails
    setTimeout(() => setIsNavigating(false), 1000);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (data?.user) {
        try {
          const merchantRes = await fetch("/api/v1/merchant", {
            credentials: "include",
          });
          if (merchantRes.ok) {
            const payload = await merchantRes.json();
            const merchant = payload?.merchant;
            if (merchant?.id) {
              bindAuthenticatedMerchantSession({
                merchantId: merchant.id,
                walletAddress: merchant.settlement_wallet_address || null,
              });

              if (typeof window !== "undefined") {
                if (merchant.merchant_name) {
                  window.localStorage.setItem("merchant_name", merchant.merchant_name);
                }
                if (merchant.merchant_logo) {
                  window.localStorage.setItem("merchant_logo", merchant.merchant_logo);
                }
                if (merchant.email) {
                  window.localStorage.setItem("merchant_email", merchant.email);
                }
                if (merchant.settlement_wallet_address) {
                  window.localStorage.setItem(
                    "settlement_wallet_address",
                    merchant.settlement_wallet_address
                  );
                }
                window.dispatchEvent(new Event("merchant_profile_updated"));
              }
            }
          }
        } catch (merchantError) {
          console.warn("Failed to hydrate merchant profile after login", merchantError);
        }

        const next = searchParams.get("next");
        const destination = next && next.startsWith("/") ? next : getRedirectTarget("/vault/registry");

        if (typeof window !== "undefined") {
          window.localStorage.removeItem("opayque_next_route");
        }

        router.push(destination);
        router.refresh();
      } else {
        setMessage("Signed in successfully. Redirecting…");
      }
    } catch (err: any) {
      setError(err?.message || "Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const merchantInitial = merchantName.trim().charAt(0).toUpperCase() || "O";

  return (
    <main className="relative min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
      {/* Close Button in top right */}
      <button
        type="button"
        onClick={() => goToDestination("/")}
        disabled={isNavigating}
        className="absolute top-6 right-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-white/10 hover:text-white transition-all z-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Return to home"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-2xl my-10">
        <div className="mb-10 space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Access Control Center</p>
          <h1 className="text-5xl font-black uppercase tracking-tighter text-white">Secure Hub Unlock</h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-400">
            Re-enter your credentials to restore access to your developer workspace.
          </p>
        </div>

        <div className="rounded-[3rem] border border-white/10 bg-zinc-900/70 p-8 shadow-[0_0_40px_rgba(168,85,247,0.18)]">
          <div className="flex flex-col items-center gap-5 rounded-[2.5rem] border border-white/10 bg-zinc-950/90 p-6 text-center shadow-xl shadow-black/30">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-700 to-fuchsia-500 overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.25)]">
              {merchantLogo ? (
                <img src={merchantLogo} alt={`${merchantName} logo`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-white">{merchantInitial}</span>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Merchant Identity</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">{merchantName}</h2>
            </div>
          </div>

          <div className="mt-8 rounded-[2.5rem] border border-white/10 bg-black/50 p-8">
            <p className="text-sm leading-6 text-zinc-400">{infoText}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Email address
                <div className="mt-3 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <Mail className="h-4 w-4" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                      required
                    />
                  </div>
                </div>
              </label>

              <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Password
                <div className="mt-3 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <Lock className="h-4 w-4" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                      required
                    />
                  </div>
                </div>
              </label>

              {error && (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {message}
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                {/* Create Account Link (Bottom-Left) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextTarget = getRedirectTarget("/vault/registry");
                    goToDestination(`/onboarding?next=${encodeURIComponent(nextTarget)}`);
                  }}
                  disabled={isNavigating}
                  className="flex items-center justify-center gap-2 rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-300 transition hover:bg-white/10 hover:text-white w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Create Account</span>
                </button>

                {/* Unlock Hub Primary Action */}
                <button
                  type="submit"
                  disabled={isLoading || isNavigating}
                  className="flex flex-1 w-full items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{isLoading ? "Unlocking…" : "Unlock Hub"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
