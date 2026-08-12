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
  Mail,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  environment: "Production" | "Sandbox";
  network: "Mainnet" | "Testnet";
  publishable: string;
  secret?: string;
  createdAt: string;
  lastUsed: string;
}

const abbreviateAddress = (address: string) => {
  if (!address) return "-";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("Opayque Merchant");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEnv = window.localStorage.getItem("developer_environment");
    if (storedEnv === "production") setIsLiveMode(true);

    const loadData = async () => {
      try {
        const [merchantRes, keysRes] = await Promise.all([
          fetch('/api/v1/merchant'),
          fetch('/api/v1/keys'),
        ]);

        if (merchantRes.ok) {
          const payload = await merchantRes.json();
          const merchant = payload?.merchant;
          if (merchant?.email) setMerchantEmail(merchant.email);
          if (merchant?.merchant_name) setMerchantName(merchant.merchant_name);
          if (merchant?.merchant_logo) setMerchantLogo(merchant.merchant_logo);
          if (merchant?.secondary_email) setSecondaryEmail(merchant.secondary_email);
          if (merchant?.settlement_wallet_address) setSettlementWalletAddress(merchant.settlement_wallet_address);
        }

        if (keysRes.ok) {
          const data = await keysRes.json();
          const transformed = (data.keys || []).map((k: any) => ({
            id: k.id,
            environment: k.environment === 'mainnet' ? 'Production' : 'Sandbox',
            network: k.environment === 'mainnet' ? 'Mainnet' : 'Testnet',
            publishable: `${k.prefix}pub_${k.id.slice(0, 8)}`,
            secret: undefined,
            createdAt: k.created_at ?? '',
            lastUsed: k.last_used_at ? 'recent' : 'never',
          }));
          setKeyPairs(transformed);
        }
      } catch (error) {
        console.warn('Failed to load keys page data', error);
      }
    };

    void loadData();
  }, []);

  const activeEnvironmentText = isLiveMode ? "Live Mode (Production)" : "Test Mode (Sandbox)";
  const activeBadgeClasses = isLiveMode
    ? "bg-purple-600/10 border-purple-500/30 text-purple-300"
    : "bg-emerald-600/10 border-emerald-500/30 text-emerald-300";

  const primaryEmailAvailable = Boolean(merchantEmail.trim());

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
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: isLiveMode ? 'mainnet' : 'sandbox' }),
      });

      if (!res.ok) throw new Error('Failed to create key');
      const data = await res.json();

      const newKey: ApiKeyPair = {
        id: data.id,
        environment: data.environment === 'mainnet' ? 'Production' : 'Sandbox',
        network: data.environment === 'mainnet' ? 'Mainnet' : 'Testnet',
        publishable: data.prefix + 'pub_' + data.id.slice(0, 8),
        secret: data.rawSecretKey,
        createdAt: data.createdAt || new Date().toISOString(),
        lastUsed: 'never',
      };
      setKeyPairs((current) => [newKey, ...current]);
      setVisibleSecretId(data.id);
    } catch (error) {
      console.error(error);
      setProfileError('Unable to create a new key pair. Please try again.');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const res = await fetch('/api/v1/merchant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: merchantName.trim(),
          merchantLogo: merchantLogo?.trim() || null,
          secondaryEmail: secondaryEmail.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || 'Unable to save merchant details');
      }

      const data = await res.json();
      setProfileMessage('Merchant details updated successfully.');
      if (data?.merchant?.merchant_name) setMerchantName(data.merchant.merchant_name);
      if (data?.merchant?.merchant_logo) setMerchantLogo(data.merchant.merchant_logo);
      if (data?.merchant?.secondary_email) setSecondaryEmail(data.merchant.secondary_email);
    } catch (error: any) {
      console.error(error);
      setProfileError(error?.message || 'Unable to save merchant details.');
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

  const handleToggleEnvironment = () => {
    setIsLiveMode((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('developer_environment', next ? 'production' : 'sandbox');
      }
      return next;
    });
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
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden">
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
                API Keys & Merchant Details
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400 leading-7 mt-3">
                A single control panel for your merchant onboarding fields, secondary access email, and API key governance.
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
          <section className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Merchant profile</p>
                <h2 className="mt-3 text-3xl font-black text-white">Editable onboarding fields</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.28em] ${activeBadgeClasses}`}>
                  {activeEnvironmentText}
                </span>
                <button
                  type="button"
                  onClick={handleToggleEnvironment}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white transition hover:border-purple-400/40 hover:bg-purple-500/10"
                >
                  Toggle environment
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="space-y-5 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500">Merchant name</label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(event) => setMerchantName(event.target.value)}
                  className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                  placeholder="Your company name"
                />

                <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500">Merchant logo URL</label>
                <input
                  type="url"
                  value={merchantLogo ?? ""}
                  onChange={(event) => setMerchantLogo(event.target.value)}
                  className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="space-y-5 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs uppercase tracking-[0.28em] text-zinc-500">Primary email</label>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-300">Read only</span>
                </div>
                <input
                  type="email"
                  value={merchantEmail}
                  readOnly
                  placeholder="merchant@example.com"
                  className="w-full cursor-not-allowed rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-zinc-400 outline-none"
                />

                <label className="block text-xs uppercase tracking-[0.28em] text-zinc-500">Secondary email</label>
                <input
                  type="email"
                  value={secondaryEmail}
                  onChange={(event) => setSecondaryEmail(event.target.value)}
                  className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                  placeholder="security@example.com"
                />

                <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-400">
                  Secondary emails are used for access gate notifications and backup verification alerts.
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {profileMessage && <p className="text-sm text-emerald-300">{profileMessage}</p>}
                {profileError && <p className="text-sm text-rose-400">{profileError}</p>}
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

          <aside className="space-y-6">
            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
              <div className="flex items-center gap-3 text-purple-300">
                <ShieldCheck size={18} />
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Access gate</p>
              </div>
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Send a notification when access is restored or the hub is locked. Emails are delivered to the primary merchant address, plus any secondary backup email configured here.
                </p>
                <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-zinc-500">Notification recipients</p>
                  <div className="mt-4 space-y-2 text-sm text-zinc-300">
                    {merchantEmail && <p>{merchantEmail}</p>}
                    {secondaryEmail ? <p>{secondaryEmail}</p> : <p className="text-zinc-500">Add a secondary email above to enable gating alerts.</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendAccessNotification}
                  disabled={sendingNotification || !primaryEmailAvailable}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                >
                  <Send size={16} /> {sendingNotification ? 'Sending…' : 'Send access gate notification'}
                </button>
                {notificationMessage && <p className="text-sm text-emerald-300">{notificationMessage}</p>}
                {notificationError && <p className="text-sm text-rose-400">{notificationError}</p>}
              </div>
            </div>

            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
              <div className="flex items-center gap-3 text-zinc-300">
                <Mail size={18} />
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Settlement wallet</p>
              </div>
              <div className="mt-6 rounded-[2.5rem] border border-white/10 bg-black/60 p-6">
                <p className="text-sm text-zinc-400">Current configured payout wallet.</p>
                <p className="mt-4 text-sm font-mono text-white break-all">{settlementWalletAddress || 'Not configured'}</p>
              </div>
            </div>
          </aside>
        </div>

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
                No API keys created yet. Generate a key pair to start integrating.
              </div>
            ) : (
              keyPairs.map((item) => (
                <div key={item.id} className="rounded-[2.5rem] border border-white/10 bg-black/60 p-6">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{item.environment}</p>
                      <p className="mt-2 text-sm font-black uppercase tracking-[0.28em] text-white">{item.network}</p>
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
                          const res = await fetch(`/api/v1/keys?id=${item.id}`, { method: 'DELETE' });
                          if (!res.ok) throw new Error('Delete failed');
                          setKeyPairs((cur) => cur.filter((k) => k.id !== item.id));
                        } catch (err) {
                          console.error(err);
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
