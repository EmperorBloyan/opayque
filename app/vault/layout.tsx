"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { createClient } from "@/lib/supabase/client";
import { clearActiveSession } from "@/lib/crypto/session";
import { bindAuthenticatedMerchantSession } from "@/lib/crypto/session";
import { clearMerchantProfileCache } from "@/lib/client/merchantProfileCache";
import { reauthenticateForSensitiveAction } from "@/lib/client/reauthenticate";
import type { TransferMode } from "@/lib/payments/transferMode";
import WalletConnectPanel from "@/components/wallet/WalletConnectPanel";
import {
  LucideLayoutDashboard,
  LucideSettings2,
  LucideCamera,
  LucideShieldCheck,
  LucideShieldAlert,
  LucidePencilLine,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  LogOut,
} from "lucide-react";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const isStandaloneCheckout = pathname === "/vault/checkout";

  const [merchantName, setMerchantName] = useState("Opayque");
  const [logo, setLogo] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState("Opayque");
  const [draftLogo, setDraftLogo] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftSecondaryEmail, setDraftSecondaryEmail] = useState("");
  const [draftWebsiteUrl, setDraftWebsiteUrl] = useState("");
  const [draftWebhookUrl, setDraftWebhookUrl] = useState("");
  const [defaultTransferMode, setDefaultTransferMode] = useState<TransferMode>("private");
  const [settlementWallet, setSettlementWallet] = useState("");
  const [refundWallet, setRefundWallet] = useState("");
  const [walletModalPurpose, setWalletModalPurpose] = useState<"settlement" | "refund" | null>(null);
  const [walletUpdateError, setWalletUpdateError] = useState<string | null>(null);
  const [walletUpdateLoading, setWalletUpdateLoading] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isHydratingMerchant, setIsHydratingMerchant] = useState(true);

  const hydrateMerchantProfile = async () => {
    setIsHydratingMerchant(true);
    try {
      const res = await fetch("/api/v1/merchant", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) clearMerchantProfileCache();
        return;
      }

      const payload = await res.json();
      const merchant = payload?.merchant;
      if (!merchant) {
        clearMerchantProfileCache();
        return;
      }
      if (merchant.id) {
        bindAuthenticatedMerchantSession({
          merchantId: merchant.id,
          walletAddress: merchant.settlement_wallet_address || null,
        });
      }
      if (merchant.merchant_name) {
        const name = merchant.merchant_name;
        setMerchantName(name);
        setDraftName(name);
        localStorage.setItem("merchant_name", name);
      } else {
        localStorage.removeItem("merchant_name");
      }
      if (merchant.merchant_logo) {
        const logoUrl = merchant.merchant_logo;
        setLogo(logoUrl);
        setDraftLogo(logoUrl);
        localStorage.setItem("merchant_logo", logoUrl);
      } else {
        localStorage.removeItem("merchant_logo");
      }
      setDraftEmail(merchant.email ?? "");
      setDraftSecondaryEmail(merchant.secondary_email ?? "");
      setDraftWebsiteUrl(merchant.website_url ?? "");
      setDraftWebhookUrl(merchant.webhook_url ?? "");
      setDefaultTransferMode(merchant.default_transfer_mode === "public" ? "public" : "private");
      setSettlementWallet(merchant.settlement_wallet_address ?? "");
      setRefundWallet(merchant.refund_wallet_address ?? "");
      if (merchant.settlement_wallet_address) {
        localStorage.setItem("settlement_wallet_address", merchant.settlement_wallet_address);
      } else {
        localStorage.removeItem("settlement_wallet_address");
      }
    } catch (error) {
      console.warn("Failed to hydrate vault merchant profile", error);
    } finally {
      setIsHydratingMerchant(false);
    }
  };

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
    localStorage.setItem("merchant_email", draftEmail.trim());
    localStorage.setItem("secondary_email", draftSecondaryEmail.trim());
    localStorage.setItem("website_url", draftWebsiteUrl.trim());
    localStorage.setItem("webhook_url", draftWebhookUrl.trim());
    localStorage.setItem("default_transfer_mode", defaultTransferMode);

    try {
      const authenticatedUser = (await createClient().auth.getUser()).data.user;
      if (!authenticatedUser) throw new Error("Not logged in");
      if (draftEmail.trim() !== (authenticatedUser.email ?? "").trim()) {
        await reauthenticateForSensitiveAction();
        const { error: emailError } = await createClient().auth.updateUser({ email: draftEmail.trim() });
        if (emailError) throw emailError;
      }
      const response = await fetch("/api/v1/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName: nextName,
          merchantLogo: nextLogo ?? null,
          email: draftEmail.trim() || null,
          secondaryEmail: draftSecondaryEmail.trim() || null,
          websiteUrl: draftWebsiteUrl.trim() || null,
          webhookUrl: draftWebhookUrl.trim() || null,
          defaultTransferMode,
        }),
      });
      if (!response.ok) throw new Error("Unable to save merchant profile");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("merchant_profile_updated"));
      }
    } catch (error) {
      console.warn("Unable to sync merchant profile", error);
    }

    setIsEditingProfile(false);
  };

  const copyWallet = async (wallet: string) => {
    if (!wallet || !navigator.clipboard) return;
    await navigator.clipboard.writeText(wallet);
    setCopiedWallet(wallet);
    window.setTimeout(() => setCopiedWallet(null), 2000);
  };

  const handleWalletUpdate = async () => {
    if (!walletModalPurpose || !publicKey) {
      setWalletUpdateError("Connect the wallet you want to use first.");
      return;
    }

    setWalletUpdateLoading(true);
    setWalletUpdateError(null);
    try {
      await reauthenticateForSensitiveAction();
      const newWalletAddress = publicKey.toBase58();
      const challengeResponse = await fetch("/api/v1/merchant/wallet-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newWalletAddress, purpose: walletModalPurpose }),
      });
      const challenge = await challengeResponse.json().catch(() => ({}));
      if (!challengeResponse.ok || typeof challenge.message !== "string") {
        throw new Error(challenge.error || "Unable to create wallet challenge");
      }
      if (!signMessage) throw new Error("This wallet cannot sign messages");
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const bytes = btoa(Array.from(signature).map((byte) => String.fromCharCode(byte)).join(""));
      const updateResponse = await fetch("/api/v1/merchant/update-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newWalletAddress, message: challenge.message, signature: bytes, nonce: challenge.nonce, purpose: walletModalPurpose }),
      });
      const update = await updateResponse.json().catch(() => ({}));
      if (!updateResponse.ok) throw new Error(update.error || "Unable to update wallet");
      if (walletModalPurpose === "refund") setRefundWallet(newWalletAddress);
      else setSettlementWallet(newWalletAddress);
      localStorage.setItem(walletModalPurpose === "refund" ? "refund_wallet_address" : "settlement_wallet_address", newWalletAddress);
      setWalletModalPurpose(null);
    } catch (error) {
      setWalletUpdateError(error instanceof Error ? error.message : "Wallet update failed");
    } finally {
      setWalletUpdateLoading(false);
    }
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

  const handleLockHub = () => {
    router.push("/");
  };

  const handleSignOut = async () => {
    if (isLocking) return;
    setIsLocking(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Supabase sign-out failed during vault sign-out", error);
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

  const displayVaultId = settlementWallet.trim() || publicKey?.toBase58() || "";
  const addressContent = displayVaultId
    ? `${displayVaultId.slice(0, 4)}...${displayVaultId.slice(-4)}`
    : isHydratingMerchant
      ? "Loading merchant..."
      : "No settlement wallet";

  if (isStandaloneCheckout) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-black px-4 py-4 text-white selection:bg-purple-500/30 sm:p-6">
      <div
        id="vault-glow"
        className="fixed inset-0 bg-purple-500/5 pointer-events-none transition-all duration-500"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
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

          <nav className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-md md:w-auto md:gap-3">
            <Link
              href="/vault/dashboard"
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all sm:px-6 md:flex-none ${
                pathname.startsWith("/vault/dashboard")
                  ? "bg-white text-black shadow-xl shadow-white/5"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <LucideLayoutDashboard size={14} /> Dashboard
            </Link>

            <Link
              href="/vault/registry"
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all sm:px-6 md:flex-none ${
                pathname.startsWith("/vault/registry")
                  ? "bg-white text-black shadow-xl shadow-white/5"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <LucideSettings2 size={14} /> Registry
            </Link>

            <button
              type="button"
              onClick={handleLockHub}
              disabled={isLocking}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-purple-500/40 hover:text-white disabled:opacity-50 sm:px-4 md:ml-auto"
            >
              <Lock size={14} />
              {isLocking ? "Locking..." : "Lock Hub"}
            </button>
          </nav>
        </header>

        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-6 md:items-center">
            <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-purple-950/30 ring-1 ring-white/5 sm:max-h-[calc(100vh-3rem)] sm:p-6">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Edit Merchant Profile
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    Merchant details
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Manage the identity, contact details, wallets, and transfer defaults used across your vault.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Merchant profile</p>
                    <p className="mt-1 text-sm text-zinc-500">The identity customers see during checkout.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
                    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-violet-700 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,0.35)] flex items-center justify-center text-2xl font-black text-white">
                        {draftLogo ? <img src={draftLogo} alt="Avatar preview" className="h-full w-full object-cover" /> : <LucideCamera size={18} />}
                      </div>
                      <label className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Brand image</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="mt-2 w-full min-w-0 text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-[0.12em] file:text-white hover:file:bg-violet-500" />
                      </label>
                    </div>
                    <label className="block rounded-xl border border-white/10 bg-black/20 p-4">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Merchant name</span>
                      <input type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Contact and integrations</p>
                    <p className="mt-1 text-sm text-zinc-500">Keep operational and webhook details current.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                  {[
                  { label: "Email", value: draftEmail, setter: setDraftEmail, type: "email" },
                  { label: "Secondary email", value: draftSecondaryEmail, setter: setDraftSecondaryEmail, type: "email" },
                  { label: "Website URL", value: draftWebsiteUrl, setter: setDraftWebsiteUrl, type: "url" },
                  { label: "Webhook URL", value: draftWebhookUrl, setter: setDraftWebhookUrl, type: "url" },
                ].map(({ label, value, setter, type }) => (
                  <label key={label} className="block rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{label}</span>
                    <input
                      type={type}
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-3 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </label>
                ))}
                  </div>
                </section>

                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  className="inline-flex w-full justify-center rounded-xl bg-purple-600 px-6 py-3.5 text-xs font-black uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:bg-purple-500 hover:brightness-110"
                >
                  Save Profile
                </button>

                <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
                  <legend className="px-1 text-xs uppercase tracking-[0.24em] text-zinc-400">Wallet addresses</legend>
                  <p className="-mt-1 text-sm text-zinc-500">Control where settlements and refunds are signed from.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="cursor-pointer rounded-2xl border border-white/10 bg-zinc-900/70 p-4 transition hover:border-white/20">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Settlement address</p>
                      <div className="mt-3 flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate font-mono text-sm text-purple-200">{isHydratingMerchant ? "Loading merchant..." : settlementWallet || "Not configured"}</p>
                        <button type="button" onClick={() => void copyWallet(settlementWallet)} disabled={!settlementWallet} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase disabled:opacity-40">
                          {copiedWallet === settlementWallet ? <Check size={12} /> : <Copy size={12} />} Copy
                        </button>
                      </div>
                      <button type="button" onClick={() => { setWalletUpdateError(null); setWalletModalPurpose("settlement"); }} className="mt-4 rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">Update settlement</button>
                    </div>

                    <div className="cursor-pointer rounded-2xl border border-white/10 bg-zinc-900/70 p-4 transition hover:border-white/20">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Refund wallet</p>
                      <p className="mt-3 truncate font-mono text-sm text-purple-200">{refundWallet || "Not configured"}</p>
                      <p className="mt-3 text-[10px] text-zinc-500">Used as the signing source when issuing refunds. Does not need a separate on-chain vault.</p>
                      <button type="button" onClick={() => { setWalletUpdateError(null); setWalletModalPurpose("refund"); }} className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">{refundWallet ? "Update refund wallet" : "Connect refund wallet"}</button>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
                  <legend className="px-1 text-xs uppercase tracking-[0.24em] text-zinc-400">Default transfer mode</legend>
                  <p className="-mt-1 text-sm text-zinc-500">Choose the default privacy behavior for new transfers.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["private", "public"] as const).map((mode) => (
                      <label key={mode} className={`cursor-pointer rounded-2xl border p-4 transition ${defaultTransferMode === mode ? "border-violet-400/70 bg-violet-500/10" : "border-white/10 bg-zinc-900/70 hover:border-white/20"}`}>
                        <input
                          type="radio"
                          name="vault-default-transfer-mode"
                          value={mode}
                          checked={defaultTransferMode === mode}
                          onChange={() => setDefaultTransferMode(mode)}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between text-sm font-bold text-white">
                          {mode === "private" ? "Private" : "Standard"}
                          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{defaultTransferMode === mode ? "Selected" : "Select"}</span>
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-zinc-400">
                          {mode === "private" ? "MagicBlock shields amounts and counterparties. Failures never become public." : "Standard Solana USDC transfer. Fully visible on explorers."}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <section className="rounded-[2rem] border border-red-500/30 bg-red-950/20 p-4 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.34em] text-red-300/80">Danger zone</p>
                      <h3 className="text-xl font-black uppercase tracking-tight text-white">Sign out and remove access</h3>
                      <p className="text-xs text-zinc-300">
                        Sign out completely from the vault. You can sign in again to re-register or continue with your existing credentials.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      disabled={isLocking}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut size={14} /> {isLocking ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {walletModalPurpose && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" role="presentation">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" role="dialog" aria-modal="true">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{walletModalPurpose === "refund" ? "Refund wallet" : "Settlement wallet"}</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Connect and sign</h2>
                </div>
                <button type="button" onClick={() => setWalletModalPurpose(null)} className="text-sm text-zinc-400">Close</button>
              </div>
              <WalletConnectPanel className="!h-11 !w-full !rounded-xl !bg-white !text-black !text-[10px] !font-black !uppercase !tracking-[0.2em]" />
              <p className="mt-4 truncate font-mono text-sm text-white">{publicKey?.toBase58() || "Connect a wallet to continue"}</p>
              {walletUpdateError && <p className="mt-3 text-sm text-red-300">{walletUpdateError}</p>}
              <button type="button" onClick={() => void handleWalletUpdate()} disabled={walletUpdateLoading || !publicKey || !signMessage} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] disabled:opacity-50">
                <ShieldCheck size={14} /> {walletUpdateLoading ? "Confirming..." : "Sign & Confirm"}
              </button>
            </div>
          </div>
        )}

        <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>

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
