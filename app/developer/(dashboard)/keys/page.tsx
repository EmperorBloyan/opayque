"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession } from "@/lib/crypto/session";
import { useEnvironment } from "@/lib/context/EnvironmentContext";
import { createClient } from "@/lib/supabase/client";
import { resolveMerchantAccessStatus } from "@/lib/auth/merchantAccess";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Key,
  Lock,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Unlock,
  Upload,
  Wallet,
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  publishable: string;
  secret?: string;
  createdAt: string;
  lastUsed: string;
  environment?: "mainnet" | "devnet";
}

function computeEffectiveMerchantStatus(merchant: any) {
  const hasSavedMerchantProfile = Boolean(
    merchant?.email ||
    merchant?.merchant_name ||
    merchant?.merchant_logo ||
    merchant?.secondary_email ||
    merchant?.settlement_wallet_address ||
    merchant?.website_url ||
    merchant?.webhook_url ||
    merchant?.api_key
  );

  const nextStatus = resolveMerchantAccessStatus(merchant?.api_access_status, merchant?.api_key);
  const hasUsableKey = Boolean(merchant?.api_key && String(merchant.api_key).trim());

  if (nextStatus === "approved") return "active";
  if (nextStatus === "pending" && hasSavedMerchantProfile && hasUsableKey) return "active";
  if (nextStatus === "active" || nextStatus === "revoked") return nextStatus;

  return "pending";
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isSandbox } = useEnvironment();
  const supabase = createClient();

  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [merchantApiAccessStatus, setMerchantApiAccessStatus] = useState<"pending" | "active" | "revoked">("pending");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const [isEmailReadOnly, setIsEmailReadOnly] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  const goToDestination = (path: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(path);
    setTimeout(() => setIsNavigating(false), 1000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadData = async () => {
      const localStatus = window.localStorage.getItem("merchant_api_access_status");
      if (localStatus === "active") {
        setMerchantApiAccessStatus("active");
      }

      const localEmail = window.localStorage.getItem("merchant_email") || window.localStorage.getItem("email") || "";
      const localName = window.localStorage.getItem("merchant_name") || "";
      const localLogo = window.localStorage.getItem("merchant_logo") || "";
      const localSecondary = window.localStorage.getItem("secondary_email") || "";
      const localWallet = window.localStorage.getItem("settlement_wallet_address") || "";
      const localWebsite = window.localStorage.getItem("website_url") || "";
      const localWebhook = window.localStorage.getItem("webhook_url") || "";

      if (localEmail) setMerchantEmail(localEmail);
      if (localName) setMerchantName(localName);
      if (localLogo) setMerchantLogo(localLogo);
      if (localSecondary) setSecondaryEmail(localSecondary);
      if (localWallet) setSettlementWalletAddress(localWallet);
      if (localWebsite) setWebsiteUrl(localWebsite);
      if (localWebhook) setWebhookUrl(localWebhook);

      const cachedKeys = window.localStorage.getItem("opayque_api_keys");
      if (cachedKeys) {
        try {
          const parsed = JSON.parse(cachedKeys);
          if (Array.isArray(parsed)) setKeyPairs(parsed);
        } catch (error) {
          console.warn("Failed to parse cached keys", error);
        }
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        const [merchantRes, keysRes] = await Promise.all([
          fetch("/api/v1/merchant").catch(() => null),
          fetch("/api/v1/keys").catch(() => null),
        ]);

        if (user) {
          const { data: merchantData } = await supabase
            .from("merchants")
            .select("api_key, api_access_status, email, merchant_name, merchant_logo, secondary_email, settlement_wallet_address, website_url, webhook_url")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          if (merchantData?.api_key) {
            setKeyPairs((prev) => {
              if (prev.length > 0) return prev;
              const prefix = merchantData.api_key.startsWith("osk_test_") ? "osk_test_" : "osk_live_";
              return [{
                id: "db-key-1",
                publishable: `${prefix}pub_saved`,
                secret: merchantData.api_key,
                createdAt: new Date().toISOString(),
                lastUsed: "never",
                environment: prefix.includes("test") ? "devnet" : "mainnet",
              }];
            });
          }

          if (merchantData) {
            const effectiveStatus = computeEffectiveMerchantStatus(merchantData) as "pending" | "active" | "revoked";
            setMerchantApiAccessStatus(effectiveStatus);
            if (effectiveStatus === "active") {
              window.localStorage.setItem("merchant_api_access_status", "active");
            } else {
              window.localStorage.setItem("merchant_api_access_status", "pending");
            }
            if (merchantData.email) setMerchantEmail(merchantData.email);
            if (merchantData.merchant_name) {
              setMerchantName(merchantData.merchant_name);
              window.localStorage.setItem("merchant_name", merchantData.merchant_name);
            }
            if (merchantData.merchant_logo) {
              setMerchantLogo(merchantData.merchant_logo);
              window.localStorage.setItem("merchant_logo", merchantData.merchant_logo);
            }
            if (merchantData.secondary_email) setSecondaryEmail(merchantData.secondary_email);
            if (merchantData.settlement_wallet_address) setSettlementWalletAddress(merchantData.settlement_wallet_address);
            if (merchantData.website_url) setWebsiteUrl(merchantData.website_url);
            if (merchantData.webhook_url) setWebhookUrl(merchantData.webhook_url);
          }
        }

        if (merchantRes && merchantRes.ok) {
          const payload = await merchantRes.json();
          const merchant = payload?.merchant;
          if (merchant) {
            const effectiveStatus = computeEffectiveMerchantStatus(merchant) as "pending" | "active" | "revoked";
            setMerchantApiAccessStatus(effectiveStatus);
            window.localStorage.setItem("merchant_api_access_status", effectiveStatus === "active" ? "active" : "pending");
            if (merchant.email) setMerchantEmail(merchant.email);
            if (merchant.merchant_name) {
              setMerchantName(merchant.merchant_name);
              window.localStorage.setItem("merchant_name", merchant.merchant_name);
            }
            if (merchant.merchant_logo) {
              setMerchantLogo(merchant.merchant_logo);
              window.localStorage.setItem("merchant_logo", merchant.merchant_logo);
            }
            if (merchant.secondary_email) setSecondaryEmail(merchant.secondary_email);
            if (merchant.settlement_wallet_address) setSettlementWalletAddress(merchant.settlement_wallet_address);
            if (merchant.website_url) setWebsiteUrl(merchant.website_url);
            if (merchant.webhook_url) setWebhookUrl(merchant.webhook_url);
          }
        }

        if (keysRes && keysRes.ok) {
          const data = await keysRes.json();
          if (Array.isArray(data?.keys)) {
            const transformed: ApiKeyPair[] = data.keys.map((k: any) => ({
              id: String(k.id || ""),
              publishable: k.prefix ? `${k.prefix}pub_${String(k.id || "").slice(0, 8)}` : `osk_pub_${String(k.id || "").slice(0, 8)}`,
              secret: k.rawSecretKey || undefined,
              createdAt: k.created_at || new Date().toISOString(),
              lastUsed: k.last_used_at ? "recent" : "never",
              environment: (k.environment === "mainnet" || k.environment === "live") ? "mainnet" : "devnet",
            }));

            if (transformed.length > 0) {
              setKeyPairs(transformed);
              window.localStorage.setItem("opayque_api_keys", JSON.stringify(transformed));
            }
          }
        }
      } catch (error) {
        console.warn("Backend API offline or unauthenticated. Using local cache.", error);
      } finally {
        setLoadingKeys(false);
      }
    };

    void loadData();
  }, [supabase]);

  const primaryEmailAvailable = Boolean((merchantEmail || "").trim());

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setMerchantLogo(result);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_logo", result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleVisibility = (id: string) => {
    setVisibleSecretId((current) => (current === id ? null : id));
  };

  const handleCopyKey = async (id: string, value: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedKeyId(id);
      window.setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (error) {
      console.warn("Copy failed", error);
    }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setProfileMessage(null);
    setProfileError(null);

    const targetEnv = isSandbox ? 'devnet' : 'mainnet';

    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: targetEnv }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create API key');
      }

      // Reject temporary keys if backend still returns one
      if (data.isTemporary || String(data.id || '').startsWith('temp_')) {
        throw new Error(
          'Merchant profile is incomplete. Save settlement wallet, then create a real key.'
        );
      }

      const newKey: ApiKeyPair = {
        id: data.id,
        publishable:
          data.publishableKey ||
          `${data.prefix || (isSandbox ? 'osk_test_' : 'osk_live_')}pub_${String(data.id).slice(0, 8)}`,
        secret: data.rawSecretKey,
        createdAt: data.createdAt || new Date().toISOString(),
        lastUsed: 'never',
        environment: targetEnv === 'devnet' ? 'devnet' : 'mainnet',
      };

      setKeyPairs((current) => {
        const updated = [newKey, ...current];
        window.localStorage.setItem('opayque_api_keys', JSON.stringify(updated));
        return updated;
      });

      setVisibleSecretId(newKey.id);
      setProfileMessage(
        'New API key created. Copy the secret now — it will not be shown again.'
      );
    } catch (error: any) {
      setProfileError(error?.message || 'Could not create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("merchant_email", merchantEmail.trim());
      window.localStorage.setItem("merchant_name", merchantName.trim());
      window.localStorage.setItem("merchant_logo", merchantLogo.trim());
      window.localStorage.setItem("secondary_email", secondaryEmail.trim());
      window.localStorage.setItem("settlement_wallet_address", settlementWalletAddress.trim());
      window.localStorage.setItem("website_url", websiteUrl.trim());
      window.localStorage.setItem("webhook_url", webhookUrl.trim());
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const payload = {
        email: merchantEmail.trim() || null,
        merchantName: merchantName.trim() || null,
        merchantLogo: merchantLogo.trim() || null,
        secondaryEmail: secondaryEmail.trim() || null,
        settlementWalletAddress: settlementWalletAddress.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        webhookUrl: webhookUrl.trim() || null,
      };

      const { error: supabaseError } = await supabase
        .from("merchants")
        .update({
          email: payload.email,
          merchant_name: payload.merchantName,
          merchant_logo: payload.merchantLogo,
          secondary_email: payload.secondaryEmail,
          settlement_wallet_address: payload.settlementWalletAddress,
          website_url: payload.websiteUrl,
          webhook_url: payload.webhookUrl,
          api_access_status: "active",
          onboarding_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", user.id);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_api_access_status", "active");
      }

      if (supabaseError) {
        throw new Error(supabaseError.message || "Supabase merchant update failed");
      }

      const res = await fetch("/api/v1/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          ...payload,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to save merchant details");
      }

      const data = await res.json();
      const normalizedStatus = computeEffectiveMerchantStatus(data?.merchant ?? {
        api_access_status: "active",
        api_key: data?.merchant?.api_key || null,
        email: payload.email,
        merchant_name: payload.merchantName,
        merchant_logo: payload.merchantLogo,
        secondary_email: payload.secondaryEmail,
        settlement_wallet_address: payload.settlementWalletAddress,
        website_url: payload.websiteUrl,
        webhook_url: payload.webhookUrl,
      }) as "pending" | "active" | "revoked";

      setProfileMessage("Merchant details saved to Supabase.");
      setMerchantApiAccessStatus(normalizedStatus);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_api_access_status", normalizedStatus === "active" ? "active" : "pending");
      }

      const updated = data?.merchant;
      if (updated) {
        if (updated.email) setMerchantEmail(updated.email);
        if (updated.merchant_name) setMerchantName(updated.merchant_name);
        if (updated.merchant_logo) setMerchantLogo(updated.merchant_logo);
        if (updated.secondary_email) setSecondaryEmail(updated.secondary_email);
        if (updated.settlement_wallet_address) setSettlementWalletAddress(updated.settlement_wallet_address);
        if (updated.website_url) setWebsiteUrl(updated.website_url);
        if (updated.webhook_url) setWebhookUrl(updated.webhook_url);
      }
    } catch (error: any) {
      console.error("Supabase update failed", error);
      setProfileError(error?.message || "Unable to save merchant details.");
      setProfileMessage(null);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendAccessNotification = async () => {
    setSendingNotification(true);
    setNotificationMessage(null);
    setNotificationError(null);

    try {
      const res = await fetch("/api/v1/merchant/notify", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || "Failed to send notification");
      }
      const body = await res.json();
      setNotificationMessage(body?.message || "Access notification sent.");
    } catch (error: any) {
      console.error(error);
      setNotificationError(error?.message || "Unable to send access notification.");
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign-out failed", error);
    }

    clearActiveSession();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("merchant_name");
      window.localStorage.removeItem("merchant_logo");
      window.localStorage.removeItem("merchant_email");
      window.localStorage.removeItem("developer_environment");
      window.localStorage.removeItem("opayque_api_keys");
      window.localStorage.setItem("opayque_next_route", "/onboarding");
    }
    goToDestination("/onboarding");
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden text-white">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.16),transparent_40%)] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_45%)] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-10">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                <Key size={12} className="text-purple-300" />
                Access Control
              </span>
              <h1 className="mt-4 text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                API Keys &amp; Merchant Details
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400 leading-7 mt-3">
                A single control panel for your merchant onboarding fields, payout configuration, and API key governance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => goToDestination("/developer/overview")}
              disabled={isNavigating}
              className="inline-flex items-center gap-2 rounded-full border-white/10 bg-zinc-900/80 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] text-white transition hover:border-purple-400/40 hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-zinc-950/30 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Merchant profile</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Business details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEmailReadOnly((prev) => !prev)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-300"
                >
                  {isEmailReadOnly ? "Edit" : "Lock"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Primary email</span>
                  <input
                    value={merchantEmail}
                    readOnly={isEmailReadOnly}
                    onChange={(event) => setMerchantEmail(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="merchant@company.com"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Merchant name</span>
                  <input
                    value={merchantName}
                    onChange={(event) => setMerchantName(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="Acme Payments"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Website URL</span>
                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="https://acme.com"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Webhook URL</span>
                  <input
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="https://api.acme.com/webhooks/opayque"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Secondary email</span>
                  <input
                    value={secondaryEmail}
                    onChange={(event) => setSecondaryEmail(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="ops@company.com"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Settlement wallet</span>
                  <input
                    value={settlementWalletAddress}
                    onChange={(event) => setSettlementWalletAddress(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-purple-400/60"
                    placeholder="Solana wallet address"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldCheck size={14} />
                  {profileSaving ? "Saving..." : "Save profile"}
                </button>

                <button
                  type="button"
                  onClick={handleSendAccessNotification}
                  disabled={sendingNotification}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={14} />
                  {sendingNotification ? "Sending..." : "Send access"}
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-red-200 transition hover:bg-red-500/20"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>

              {(profileMessage || profileError || notificationMessage || notificationError) && (
                <div className="mt-5 space-y-2 text-sm">
                  {profileMessage && <p className="text-emerald-300">{profileMessage}</p>}
                  {profileError && <p className="text-red-300">{profileError}</p>}
                  {notificationMessage && <p className="text-emerald-300">{notificationMessage}</p>}
                  {notificationError && <p className="text-red-300">{notificationError}</p>}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-zinc-950/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Branding</p>
                  <h2 className="mt-2 text-xl font-bold text-white">Merchant logo</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 p-2 text-purple-300">
                  <ImageIcon size={18} />
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
                {merchantLogo ? (
                  <img src={merchantLogo} alt="Merchant logo" className="h-24 w-24 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400">
                    <Building2 size={30} />
                  </div>
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-200">
                  <Upload size={14} /> Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-zinc-950/30 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Environment</p>
                  <h2 className="mt-2 text-xl font-bold text-white">{isSandbox ? "Sandbox" : "Production"}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${isSandbox ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"}`}>
                  {isSandbox ? "Devnet" : "Mainnet"}
                </span>
              </div>

              <div className="space-y-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <span>API access</span>
                  <span className={merchantApiAccessStatus === "active" ? "text-emerald-300" : "text-amber-300"}>{merchantApiAccessStatus === "active" ? "Active" : "Pending"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <span>Wallet attached</span>
                  <span className="text-purple-300">{settlementWalletAddress ? "Ready" : "Not set"}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-zinc-950/30 backdrop-blur-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">API governance</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Keys</h2>
            </div>

            <button
              type="button"
              onClick={handleCreateKey}
              disabled={creatingKey}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={14} />
              {creatingKey ? "Creating..." : "Create key"}
            </button>
          </div>

          {loadingKeys ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
              Loading API keys...
            </div>
          ) : keyPairs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-zinc-400">
              No API keys yet. Create your first key to start managing merchant access.
            </div>
          ) : (
            <div className="space-y-4">
              {keyPairs.map((keyPair) => {
                const isSecretVisible = visibleSecretId === keyPair.id;
                const isCopied = copiedKeyId === keyPair.id;

                return (
                  <div key={keyPair.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-300">
                          <Key size={16} />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{keyPair.environment || "mainnet"}</p>
                          <p className="mt-1 font-mono text-sm text-white">{keyPair.publishable}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(keyPair.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-200"
                        >
                          {isSecretVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                          {isSecretVisible ? "Hide" : "Reveal"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(keyPair.id, keyPair.secret || keyPair.publishable)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-200"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Publishable key</p>
                        <p className="mt-2 truncate font-mono text-xs text-zinc-200">{keyPair.publishable}</p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Secret key</p>
                        <p className="mt-2 font-mono text-xs text-zinc-200 break-all">
                          {isSecretVisible ? keyPair.secret || "Hidden" : "••••••••••••••••"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Metadata</p>
                        <p className="mt-2 text-xs text-zinc-300">Created {new Date(keyPair.createdAt).toLocaleDateString()}</p>
                        <p className="mt-1 text-xs text-zinc-300">Last used {keyPair.lastUsed}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
