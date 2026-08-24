"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { createClient } from "@/lib/supabase/client";
import { clearActiveSession } from "@/lib/crypto/session";
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
  const [settlementWallet, setSettlementWallet] = useState("");
  const [refundWallet, setRefundWallet] = useState("");
  const [walletModalPurpose, setWalletModalPurpose] = useState<"settlement" | "refund" | null>(null);
  const [walletUpdateError, setWalletUpdateError] = useState<string | null>(null);
  const [walletUpdateLoading, setWalletUpdateLoading] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
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
        setDraftEmail(merchant.email ?? "");
        setDraftSecondaryEmail(merchant.secondary_email ?? "");
        setDraftWebsiteUrl(merchant.website_url ?? "");
        setDraftWebhookUrl(merchant.webhook_url ?? "");
        setSettlementWallet(merchant.settlement_wallet_address ?? "");
        setRefundWallet(merchant.refund_wallet_address ?? "");
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
    localStorage.setItem("merchant_email", draftEmail.trim());
    localStorage.setItem("secondary_email", draftSecondaryEmail.trim());
    localStorage.setItem("website_url", draftWebsiteUrl.trim());
    localStorage.setItem("webhook_url", draftWebhookUrl.trim());

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("merchant_profile_updated"));
    }

    try {
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
        }),
      });
      if (!response.ok) throw new Error("Unable to save merchant profile");
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
                  {merchantFetchError === "unauthorized" ? (
                    <Link href="/login?next=%2Fvault%2Fdashboard" className="text-purple-300 underline underline-offset-2 hover:text-purple-200">
                      Log in
                    </Link>
                  ) : (
                    <button type="button" onClick={() => window.location.reload()} className="text-purple-300 underline underline-offset-2 hover:text-purple-200">
                      Retry
                    </button>
                  )}
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

                {[
                  { label: "Email", value: draftEmail, setter: setDraftEmail, type: "email" },
                  { label: "Secondary email", value: draftSecondaryEmail, setter: setDraftSecondaryEmail, type: "email" },
                  { label: "Website URL", value: draftWebsiteUrl, setter: setDraftWebsiteUrl, type: "url" },
                  { label: "Webhook URL", value: draftWebhookUrl, setter: setDraftWebhookUrl, type: "url" },
                ].map(({ label, value, setter, type }) => (
                  <div key={label} className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                    <label className="text-sm uppercase tracking-[0.35em] text-zinc-500">{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      className="w-full rounded-[1.8rem] border border-white/10 bg-zinc-900/70 px-5 py-3 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                ))}

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Settlement address</p>
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate font-mono text-sm text-purple-200">{settlementWallet || "Not configured"}</p>
                    <button type="button" onClick={() => void copyWallet(settlementWallet)} disabled={!settlementWallet} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase disabled:opacity-40">
                      {copiedWallet === settlementWallet ? <Check size={12} /> : <Copy size={12} />} Copy
                    </button>
                  </div>
                  <button type="button" onClick={() => { setWalletUpdateError(null); setWalletModalPurpose("settlement"); }} className="rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">Update settlement</button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Refund wallet</p>
                  <p className="truncate font-mono text-sm text-purple-200">{refundWallet || "Not configured"}</p>
                  <p className="text-[10px] text-zinc-500">Used as the signing source when issuing refunds. Does not need a separate on-chain vault.</p>
                  <button type="button" onClick={() => { setWalletUpdateError(null); setWalletModalPurpose("refund"); }} className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">{refundWallet ? "Update refund wallet" : "Connect refund wallet"}</button>
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
