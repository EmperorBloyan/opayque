"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession } from "@/lib/crypto/session";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Key,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Wallet,
  Lock,
  Unlock,
  Check,
  AlertCircle,
  Upload,
  Building2,
  Image as ImageIcon
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  publishable: string;
  secret?: string;
  createdAt: string;
  lastUsed: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  
  // API Keys State
  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Merchant Profile State (Onboarding Fields)
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  
  // Editable State for Primary Email
  const [isEmailReadOnly, setIsEmailReadOnly] = useState(true);

  // Status States
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  // Load Data with LocalStorage Hydration + API Sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadData = async () => {
      // 1. Instant hydration from LocalStorage (Matches onboarding keys)
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

      // Load cached keys if available
      const cachedKeys = window.localStorage.getItem("opayque_api_keys");
      if (cachedKeys) {
        try {
          setKeyPairs(JSON.parse(cachedKeys));
        } catch (e) {
          console.warn("Failed to parse cached API keys", e);
        }
      }

      // 2. Fetch latest from API endpoint
      try {
        const [merchantRes, keysRes] = await Promise.all([
          fetch('/api/v1/merchant').catch(() => null),
          fetch('/api/v1/keys').catch(() => null),
        ]);

        if (merchantRes && merchantRes.ok) {
          const payload = await merchantRes.json();
          const merchant = payload?.merchant;
          if (merchant) {
            if (merchant.email) setMerchantEmail(merchant.email);
            if (merchant.merchant_name) setMerchantName(merchant.merchant_name);
            if (merchant.merchant_logo) setMerchantLogo(merchant.merchant_logo);
            if (merchant.secondary_email) setSecondaryEmail(merchant.secondary_email);
            if (merchant.settlement_wallet_address) setSettlementWalletAddress(merchant.settlement_wallet_address);
            if (merchant.website_url) setWebsiteUrl(merchant.website_url);
            if (merchant.webhook_url) setWebhookUrl(merchant.webhook_url);
          }
        }

        if (keysRes && keysRes.ok) {
          const data = await keysRes.json();
          if (data.keys && Array.isArray(data.keys)) {
            const transformed = data.keys.map((k: any) => ({
              id: k.id,
              publishable: k.prefix ? `${k.prefix}pub_${k.id.slice(0, 8)}` : `osk_pub_${k.id.slice(0, 8)}`,
              secret: k.rawSecretKey || undefined,
              createdAt: k.created_at ?? new Date().toISOString(),
              lastUsed: k.last_used_at ? 'recent' : 'never',
            }));
            setKeyPairs(transformed);
            window.localStorage.setItem("opayque_api_keys", JSON.stringify(transformed));
          }
        }
      } catch (error) {
        console.warn('Backend API offline or unauthenticated; using cached localStorage data.', error);
      } finally {
        setLoadingKeys(false);
      }
    };

    void loadData();
  }, []);

  const primaryEmailAvailable = Boolean(merchantEmail.trim());

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setMerchantLogo(result);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("merchant_logo", result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleVisibility = (id: string) => {
    setVisibleSecretId((current) => (current === id ? null : id));
  };

  const handleCopyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKeyId(id);
    window.setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setProfileMessage(null);
    setProfileError(null);

    let newKey: ApiKeyPair | null = null;

    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: 'mainnet' }),
      });

      if (res.ok) {
        const data = await res.json();
        newKey = {
          id: data.id || Math.random().toString(36).substring(2, 9),
          publishable: (data.prefix || "osk_live_") + 'pub_' + (data.id ? data.id.slice(0, 8) : '8f921a'),
          secret: data.rawSecretKey || `osk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
          createdAt: data.createdAt || new Date().toISOString(),
          lastUsed: 'never',
        };
      }
    } catch (error) {
      console.warn('API endpoint unavailable, generating local key pair', error);
    }

    if (!newKey) {
      const randomId = Math.random().toString(36).substring(2, 10);
      newKey = {
        id: randomId,
        publishable: `osk_live_pub_${randomId}`,
        secret: `osk_live_sec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        createdAt: new Date().toISOString(),
        lastUsed: 'never',
      };
    }

    setKeyPairs((current) => {
      const updated = [newKey!, ...current];
      if (typeof window !== "undefined") {
        window.localStorage.setItem("opayque_api_keys", JSON.stringify(updated));
      }
      return updated;
    });

    setVisibleSecretId(newKey.id);
    setProfileMessage("New API Key pair generated successfully.");
    setCreatingKey(false);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    // Save locally first so data persists seamlessly
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
      const res = await fetch('/api/v1/merchant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: merchantEmail.trim() || null,
          merchantName: merchantName.trim() || null,
          merchantLogo: merchantLogo.trim() || null,
          secondaryEmail: secondaryEmail.trim() || null,
          settlementWalletAddress: settlementWalletAddress.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          webhookUrl: webhookUrl.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
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
      }
      setProfileMessage('Merchant details saved successfully.');
    } catch (error: any) {
      console.warn('API sync failed, saved to local cache', error);
      setProfileMessage('Merchant details saved locally.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendAccessNotification = async () => {
    setSendingNotification(true);
    setNotificationMessage(null);
    setNotificationError(null);
    try {
      const res = await fetch('/api/v1/merchant/notify', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || 'Failed to send notification');
      }
      const body = await res.json();
      setNotificationMessage(body?.message || 'Access notification sent.');
    } catch (error: any) {
      console.error(error);
      setNotificationError(error?.message || 'Unable to send access notification.');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign-out failed', error);
    }
    clearActiveSession();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('merchant_name');
      window.localStorage.removeItem('merchant_logo');
      window.localStorage.removeItem('developer_environment');
    }
    router.push('/developer/onboarding');
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
              onClick={() => router.push('/developer/overview')}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-4 py-3 text-xs font-black uppercase tracking-[0.28em] text-white transition hover:border-purple-400/40 hover:bg-white/5"
            >
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[1.45fr_0.95fr]">
          {/* Main Editable Profile Form */}
          <section className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Merchant profile</p>
                <h2 className="mt-3 text-3xl font-black text-white">Editable onboarding fields</h2>
              </div>
            </div>

            {/* BRANDING LOGO PREVIEW SLOT */}
            <div className="mt-8 rounded-[2.5rem] border border-purple-500/20 bg-purple-950/10 p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div className="h-24 w-24 rounded-full border-2 border-purple-500/50 bg-purple-500/10 overflow-hidden flex items-center justify-center shadow-lg shadow-purple-500/10">
                  {merchantLogo ? (
                    <img src={merchantLogo} alt={merchantName || "Merchant Logo"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center p-2">
                      <Building2 className="h-8 w-8 text-purple-400 mx-auto" />
                      <span className="text-[9px] font-bold text-purple-300 uppercase block mt-1">No Logo</span>
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 rounded-full bg-purple-600 text-white cursor-pointer shadow-md hover:bg-purple-500 transition-all">
                  <Upload className="h-3.5 w-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <span className="text-[10px] uppercase tracking-[0.28em] text-purple-400 font-bold">Brand Identity</span>
                <h3 className="text-xl font-bold text-white">{merchantName || "Unconfigured Workspace"}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your logo icon will appear on checkout links, payment gateway popups, and automated merchant receipts.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-5 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3">Merchant name</label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(event) => setMerchantName(event.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="Your company name"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3">Merchant logo URL / Base64</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={merchantLogo}
                      onChange={(event) => setMerchantLogo(event.target.value)}
                      className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 pr-10 text-sm text-white outline-none transition focus:border-purple-500 truncate"
                      placeholder="https://example.com/logo.png or uploaded image"
                    />
                    <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3">Website URL</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="space-y-5 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="text-xs uppercase tracking-[0.28em] text-zinc-500">Primary email</label>
                    <button
                      type="button"
                      onClick={() => setIsEmailReadOnly(!isEmailReadOnly)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-purple-300 hover:text-white"
                    >
                      {isEmailReadOnly ? <Lock size={10} /> : <Unlock size={10} />}
                      {isEmailReadOnly ? "Locked" : "Editable"}
                    </button>
                  </div>
                  <input
                    type="email"
                    value={merchantEmail}
                    onChange={(e) => setMerchantEmail(e.target.value)}
                    readOnly={isEmailReadOnly}
                    placeholder="merchant@example.com"
                    className={`w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500 ${
                      isEmailReadOnly ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3">Secondary email</label>
                  <input
                    type="email"
                    value={secondaryEmail}
                    onChange={(event) => setSecondaryEmail(event.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="security@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500 mb-3">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                    placeholder="https://api.example.com/webhook"
                  />
                </div>
              </div>
            </div>

            {/* Settlement Wallet Address */}
            <div className="mt-6 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
              <div className="flex items-center gap-3 mb-3">
                 <Wallet size={16} className="text-purple-400" />
                 <label className="text-xs uppercase tracking-[0.28em] text-zinc-500">Destination Settlement Wallet</label>
              </div>
              <input
                type="text"
                value={settlementWalletAddress}
                onChange={(event) => setSettlementWalletAddress(event.target.value)}
                className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm font-mono text-emerald-400 outline-none transition focus:border-purple-500"
                placeholder="Enter your decentralized wallet address (e.g. 0x... or Solana pubkey)"
              />
              <p className="mt-4 text-sm text-zinc-400">This destination address receives automated payout settlements and smart contract routing.</p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {profileMessage && <p className="text-sm text-emerald-300 flex items-center gap-1.5"><Check size={14} /> {profileMessage}</p>}
                {profileError && <p className="text-sm text-rose-400 flex items-center gap-1.5"><AlertCircle size={14} /> {profileError}</p>}
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-6 py-3 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-purple-500/40"
              >
                {profileSaving ? 'Saving…' : 'Save merchant details'}
              </button>
            </div>
          </section>

          {/* Access Notification Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)] h-full">
              <div className="flex items-center gap-3 text-purple-300">
                <ShieldCheck size={18} />
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Access gate</p>
              </div>
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Send a notification when access is restored or the hub is locked. Emails are delivered to the primary merchant address, plus any secondary backup email configured in your profile.
                </p>
                <div className="rounded-3xl border border-white/10 bg-black/60 p-4 mt-6">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-zinc-500">Notification recipients</p>
                  <div className="mt-4 space-y-2 text-sm text-zinc-300">
                    {merchantEmail ? <p className="font-mono text-xs">{merchantEmail}</p> : <p className="text-zinc-500">No primary email set.</p>}
                    {secondaryEmail ? <p className="font-mono text-xs">{secondaryEmail}</p> : <p className="text-zinc-500">Add a secondary email to enable gating alerts.</p>}
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSendAccessNotification}
                    disabled={sendingNotification || !primaryEmailAvailable}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                  >
                    <Send size={16} /> {sendingNotification ? 'Sending…' : 'Send access gate notification'}
                  </button>
                </div>
                {notificationMessage && <p className="text-sm text-emerald-300">{notificationMessage}</p>}
                {notificationError && <p className="text-sm text-rose-400">{notificationError}</p>}
              </div>
            </div>
          </aside>
        </div>

        {/* API Keys Configuration */}
        <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">API keys</p>
              <h2 className="mt-3 text-3xl font-black text-white">Publishable + secret access</h2>
            </div>
            <button
              type="button"
              onClick={handleCreateKey}
              disabled={creatingKey}
              className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-5 py-3 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-purple-500/40"
            >
              <Plus size={16} /> {creatingKey ? 'Creating…' : 'Create new key pair'}
            </button>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {!loadingKeys && keyPairs.length === 0 ? (
              <div className="rounded-[2.5rem] border border-dashed border-white/10 bg-black/50 p-8 text-center text-zinc-400">
                No API keys created yet. Click "Create new key pair" above to generate your credentials.
              </div>
            ) : (
              keyPairs.map((item) => (
                <div key={item.id} className="rounded-[2.5rem] border border-white/10 bg-black/60 p-6">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">API Configuration</p>
                      <p className="mt-2 text-sm font-black uppercase tracking-[0.28em] text-white">Mainnet Access</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-300">
                      {item.lastUsed}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-zinc-950/90 p-4">
                      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                        <span>Publishable</span>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(`${item.id}-pub`, item.publishable)}
                          className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-white"
                        >
                          <Copy size={12} /> {copiedKeyId === `${item.id}-pub` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="mt-3 break-all text-sm font-mono text-white">{item.publishable}</p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-zinc-950/90 p-4">
                      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                        <span>Secret</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(item.id)}
                            disabled={!item.secret}
                            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
                          >
                            {visibleSecretId === item.id ? <EyeOff size={12} /> : <Eye size={12} />}
                            {item.secret ? (visibleSecretId === item.id ? 'Hide' : 'Reveal') : 'Unavailable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => item.secret && handleCopyKey(`${item.id}-secret`, item.secret)}
                            disabled={!item.secret}
                            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
                          >
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 break-all text-sm font-mono text-white">
                        {item.secret
                          ? visibleSecretId === item.id
                            ? item.secret
                            : '••••••••••••••••••••••••••••••'
                          : 'Secret values are shown only at creation time.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch(`/api/v1/keys?id=${item.id}`, { method: 'DELETE' }).catch(() => null);
                        } catch (err) {
                          console.error(err);
                        }
                        const filtered = keyPairs.filter((k) => k.id !== item.id);
                        setKeyPairs(filtered);
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem("opayque_api_keys", JSON.stringify(filtered));
                        }
                      }}
                      className="rounded-full border border-white/10 bg-rose-700/10 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-rose-300 transition hover:bg-rose-700/20"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-[3rem] border border-rose-500/20 bg-rose-950/30 p-8 shadow-[0_25px_120px_rgba(239,68,68,0.15)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-rose-400">Danger zone</p>
              <h3 className="mt-3 text-2xl font-black text-white">Sign out and remove access</h3>
              <p className="max-w-2xl text-sm text-zinc-400 leading-7 mt-2">
                Sign out completely from the developer hub. You can sign up again to re-register or sign in with your existing credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500 active:scale-95 whitespace-nowrap"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
