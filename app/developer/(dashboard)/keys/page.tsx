"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession } from "@/lib/crypto/session";
import { useEnvironment } from "@/lib/context/EnvironmentContext";
import { createClient } from "@/lib/supabase/client";
import { resolveMerchantAccessStatus } from "@/lib/auth/merchantAccess";
import { bindAuthenticatedMerchantSession } from "@/lib/crypto/session";
import { clearMerchantProfileCache } from "@/lib/client/merchantProfileCache";
import { reauthenticateForSensitiveAction } from "@/lib/client/reauthenticate";
import type { TransferMode } from "@/lib/payments/transferMode";
import SettlementWalletSection from "@/components/wallet/SettlementWalletSection";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Lock,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
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
    merchant?.webhook_url
  );

  const nextStatus = resolveMerchantAccessStatus(merchant?.api_access_status, null);

  if (nextStatus === "approved") return "active";
  if (nextStatus === "active" || nextStatus === "revoked") return nextStatus;
  if (hasSavedMerchantProfile) return "active";

  return "pending";
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isSandbox } = useEnvironment();
  const supabase = createClient();

  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [defaultTransferMode, setDefaultTransferMode] = useState<TransferMode>("private");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [merchantApiAccessStatus, setMerchantApiAccessStatus] = useState<"pending" | "active" | "revoked">("pending");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      const localWebsite = window.localStorage.getItem("website_url") || "";
      const localWebhook = window.localStorage.getItem("webhook_url") || "";
      const localSettlementWallet = window.localStorage.getItem("settlement_wallet_address") || "";
      const localTransferMode = window.localStorage.getItem("default_transfer_mode");

      if (localEmail) setMerchantEmail(localEmail);
      if (localName) setMerchantName(localName);
      if (localLogo) setMerchantLogo(localLogo);
      if (localSecondary) setSecondaryEmail(localSecondary);
      if (localWebsite) setWebsiteUrl(localWebsite);
      if (localWebhook) setWebhookUrl(localWebhook);
      if (localSettlementWallet) setSettlementWalletAddress(localSettlementWallet);
      if (localTransferMode === "public" || localTransferMode === "private") setDefaultTransferMode(localTransferMode);

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setKeyPairs([]);
          window.localStorage.removeItem("opayque_api_keys");
          setLoadingKeys(false);
          return;
        }

        window.localStorage.removeItem("opayque_api_keys");

        const [merchantRes, keysRes] = await Promise.all([
          fetch("/api/v1/merchant").catch(() => null),
          fetch("/api/v1/keys").catch(() => null),
        ]);

        if (user) {
          const { data: merchantData } = await supabase
            .from("merchants")
            .select("id, api_access_status, email, merchant_name, merchant_logo, secondary_email, settlement_wallet_address, website_url, webhook_url, default_transfer_mode")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          if (merchantData) {
            if (merchantData.id) {
              bindAuthenticatedMerchantSession({
                merchantId: merchantData.id,
                walletAddress: merchantData.settlement_wallet_address || null,
              });
            }
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
            if (merchantData.settlement_wallet_address) {
              setSettlementWalletAddress(merchantData.settlement_wallet_address);
              window.localStorage.setItem("settlement_wallet_address", merchantData.settlement_wallet_address);
            }
            if (merchantData.website_url) setWebsiteUrl(merchantData.website_url);
            if (merchantData.webhook_url) setWebhookUrl(merchantData.webhook_url);
            setDefaultTransferMode(merchantData.default_transfer_mode === "public" ? "public" : "private");
          }
        }

        if (merchantRes && merchantRes.ok) {
          const payload = await merchantRes.json();
          const merchant = payload?.merchant;
          if (merchant) {
            if (merchant.id) {
              bindAuthenticatedMerchantSession({
                merchantId: merchant.id,
                walletAddress: merchant.settlement_wallet_address || null,
              });
            }
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
            if (merchant.settlement_wallet_address) {
              setSettlementWalletAddress(merchant.settlement_wallet_address);
              window.localStorage.setItem("settlement_wallet_address", merchant.settlement_wallet_address);
            }
            if (merchant.website_url) setWebsiteUrl(merchant.website_url);
            if (merchant.webhook_url) setWebhookUrl(merchant.webhook_url);
            setDefaultTransferMode(merchant.default_transfer_mode === "public" ? "public" : "private");
          } else {
            clearMerchantProfileCache();
          }
        } else if (merchantRes?.status === 401 || merchantRes?.status === 404) {
          clearMerchantProfileCache();
        }

        if (keysRes && keysRes.ok) {
          const data = await keysRes.json();
          if (Array.isArray(data?.keys)) {
            const transformed: ApiKeyPair[] = data.keys.map((k: any) => ({
              id: String(k.id || ""),
              publishable: k.prefix ? `${k.prefix}pub_${String(k.id || "").slice(0, 8)}` : `osk_pub_${String(k.id || "").slice(0, 8)}`,
              createdAt: k.created_at || new Date().toISOString(),
              lastUsed: k.last_used_at ? "recent" : "never",
              environment: (k.environment === "mainnet" || k.environment === "live") ? "mainnet" : "devnet",
            }));

            setKeyPairs(transformed);
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
      await reauthenticateForSensitiveAction();
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

  const handleDeleteKey = async (keyId: string) => {
    if (deletingKeyId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this API key? Existing requests using it will stop working.")) return;

    setDeletingKeyId(keyId);
    setProfileMessage(null);
    setProfileError(null);
    try {
      await reauthenticateForSensitiveAction();
      const response = await fetch(`/api/v1/keys?id=${encodeURIComponent(keyId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to delete API key");
      }

      setKeyPairs((current) => {
        const updated = current.filter((key) => key.id !== keyId);
        return updated;
      });
      setVisibleSecretId((current) => (current === keyId ? null : current));
      setCopiedKeyId((current) => (current === keyId ? null : current));
      setProfileMessage("API key deleted.");
    } catch (error: any) {
      setProfileError(error?.message || "Could not delete API key");
    } finally {
      setDeletingKeyId(null);
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
      window.localStorage.setItem("website_url", websiteUrl.trim());
      window.localStorage.setItem("webhook_url", webhookUrl.trim());
      window.localStorage.setItem("default_transfer_mode", defaultTransferMode);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      if (merchantEmail.trim() !== (user.email ?? "").trim()) {
        await reauthenticateForSensitiveAction();
        const { error: emailError } = await supabase.auth.updateUser({ email: merchantEmail.trim() });
        if (emailError) throw emailError;
      }

      const payload = {
        email: merchantEmail.trim() || null,
        merchantName: merchantName.trim() || null,
        merchantLogo: merchantLogo.trim() || null,
        secondaryEmail: secondaryEmail.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        webhookUrl: webhookUrl.trim() || null,
        defaultTransferMode,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_api_access_status", "active");
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
        email: payload.email,
        merchant_name: payload.merchantName,
        merchant_logo: payload.merchantLogo,
        secondary_email: payload.secondaryEmail,
        website_url: payload.websiteUrl,
        webhook_url: payload.webhookUrl,
        default_transfer_mode: payload.defaultTransferMode,
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
        if (updated.settlement_wallet_address) {
          setSettlementWalletAddress(updated.settlement_wallet_address);
          window.localStorage.setItem("settlement_wallet_address", updated.settlement_wallet_address);
        }
        if (updated.website_url) setWebsiteUrl(updated.website_url);
        if (updated.webhook_url) setWebhookUrl(updated.webhook_url);
        setDefaultTransferMode(updated.default_transfer_mode === "public" ? "public" : "private");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("merchant_profile_updated"));
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
    if (isSigningOut) return;
    setIsSigningOut(true);

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
    router.push("/onboarding");
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
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Merchant profile</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Business details</h2>
              </div>

              <div className="mb-8 flex flex-col items-center text-center">
                <div className="group relative mb-6">
                  <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-purple-500/50 bg-purple-500/10">
                    {merchantLogo ? (
                      <img
                        src={merchantLogo}
                        alt="Merchant logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Upload className="h-10 w-10 text-purple-400" />
                    )}
                  </div>
                </div>
                <label
                  htmlFor="merchant-logo-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-purple-500"
                >
                  <Upload size={14} /> Update picture
                </label>
                <input
                  id="merchant-logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Primary email</span>
                  <input
                    value={merchantEmail}
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

                <SettlementWalletSection
                  currentWallet={settlementWalletAddress}
                  onWalletUpdated={setSettlementWalletAddress}
                />
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
              <fieldset className="space-y-3">
                <legend className="text-xs uppercase tracking-[0.2em] text-zinc-400">Default transfer mode</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["private", "public"] as const).map((mode) => (
                    <label key={mode} className={`cursor-pointer rounded-xl border p-4 transition ${defaultTransferMode === mode ? "border-purple-400/70 bg-purple-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                      <input
                        type="radio"
                        name="default-transfer-mode"
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
                        <button
                          type="button"
                          onClick={() => void handleDeleteKey(keyPair.id)}
                          disabled={deletingKeyId === keyPair.id || Boolean(deletingKeyId)}
                          aria-label={`Delete ${keyPair.publishable}`}
                          title="Delete API key"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={13} />
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

      <section className="mt-10 rounded-[2rem] border border-red-500/30 bg-red-950/20 p-6 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.34em] text-red-300/80">Danger zone</p>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">Sign out and remove access</h3>
            <p className="max-w-2xl text-sm text-zinc-300">
              Sign out completely from the vault. You can sign in again to re-register or continue with your existing credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </section>
    </main>
  );
}
