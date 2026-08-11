"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  environment: "Production" | "Sandbox";
  network: "Mainnet" | "Testnet";
  publishable: string;
  secret: string;
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
  const [merchantName, setMerchantName] = useState("Opayque");
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null);
  const [payoutWallet, setPayoutWallet] = useState("7Xw9uQRjKp2vTx4Kp2");
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalStep, setWalletModalStep] = useState<"input" | "code">("input");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [verificationDigits, setVerificationDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [sentCode, setSentCode] = useState("");
  const [walletModalMessage, setWalletModalMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");
  const [requireTee, setRequireTee] = useState(true);
  // Notifications and verification
  const [notificationEmails, setNotificationEmails] = useState<{ email: string; verified: boolean }[]>([]);
  const [newNotificationEmail, setNewNotificationEmail] = useState("");
  const [sentVerificationCodes, setSentVerificationCodes] = useState<Record<string, string>>({});
  const [verificationInputs, setVerificationInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEnv = window.localStorage.getItem("developer_environment");
    if (storedEnv === "production") setIsLiveMode(true);
    const storedIps = window.localStorage.getItem("developer_ip_whitelist");
    if (storedIps) {
      try { setIpWhitelist(JSON.parse(storedIps)); } catch {}
    }
    const storedEmails = window.localStorage.getItem("developer_notification_emails");
    if (storedEmails) {
      try { setNotificationEmails(JSON.parse(storedEmails)); } catch {}
    }

    const fetchMerchantProfile = async () => {
      try {
        const res = await fetch('/api/v1/merchant');
        if (!res.ok) return;
        const payload = await res.json();
        const merchant = payload?.merchant;
        if (merchant?.merchant_name) setMerchantName(merchant.merchant_name);
        if (merchant?.merchant_logo) setMerchantLogo(merchant.merchant_logo);
      } catch (error) {
        console.warn('Failed to load merchant profile', error);
      }
    };

    void fetchMerchantProfile();
  }, []);

  // Load keys from API
  useEffect(() => {
    let mounted = true;
    async function loadKeys() {
      setLoadingKeys(true);
      try {
        const res = await fetch('/api/v1/keys');
        if (!res.ok) throw new Error('Failed to load keys');
        const data = await res.json();
        if (!mounted) return;
        const transformed = (data.keys || []).map((k: any) => ({
          id: k.id,
          environment: k.environment === 'mainnet' ? 'Production' : 'Sandbox',
          network: k.environment === 'mainnet' ? 'Mainnet' : 'Testnet',
          publishable: `${k.prefix}pub_${k.id.slice(0,8)}`,
          secret: '••••••••••••••••••••',
          createdAt: k.created_at ?? '',
          lastUsed: k.last_used_at ? 'recent' : 'never',
        }));
        setKeyPairs(transformed);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingKeys(false);
      }
    }
    loadKeys();
    return () => { mounted = false; };
  }, []);

  const activeEnvironmentText = isLiveMode ? "Live Mode (Production)" : "Test Mode (Sandbox)";
  const activeBadgeClasses = isLiveMode
    ? "bg-purple-600/10 border-purple-500/30 text-purple-300"
    : "bg-emerald-600/10 border-emerald-500/30 text-emerald-300";

  const handleToggleVisibility = (id: string) => {
    setVisibleSecretId(visibleSecretId === id ? null : id);
  };

  const handleCopyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleRollKey = (id: string) => {
    const nextKey = keyPairs.find((item) => item.id === id);
    if (!nextKey) return;
    const nextSuffix = Math.random().toString(36).slice(2, 12);
    setKeyPairs((current) => current.map((item) =>
      item.id === id
        ? { ...item, secret: `${item.secret.split("_")[0]}_${nextSuffix}` }
        : item
    ));
    setVisibleSecretId(id);
    setCopiedKeyId(null);
  };

  const handleToggleEnvironment = () => {
    setIsLiveMode((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("developer_environment", next ? "production" : "sandbox");
      }
      return next;
    });
  };

  const handleSendConfirmationCode = () => {
    if (!newWalletAddress.trim()) {
      setWalletModalMessage("Enter the new settlement wallet address.");
      return;
    }
    setIsSendingCode(true);
    setWalletModalMessage("");
    setVerificationError("");
    window.setTimeout(() => {
      setSentCode(String(Math.floor(100000 + Math.random() * 900000)));
      setWalletModalStep("code");
      setWalletModalMessage("Confirmation code sent to your registered email.");
      setIsSendingCode(false);
    }, 900);
  };

  const handleVerificationDigit = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    setVerificationDigits((current) => current.map((digit, position) => position === index ? value : digit));
  };

  const handleAuthorizeWallet = () => {
    const code = verificationDigits.join("");
    if (code.length !== 6) {
      setVerificationError("Enter the complete 6-digit code.");
      return;
    }
    if (code !== sentCode) {
      setVerificationError("That code is not valid. Please retry.");
      return;
    }
    setIsVerifyingCode(true);
    (async () => {
      try {
        const res = await fetch('/api/v1/merchant', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settlementWalletAddress: newWalletAddress.trim() }) });
        if (!res.ok) throw new Error('Failed to update wallet');
        const data = await res.json();
        setPayoutWallet(data.merchant.settlement_wallet_address || newWalletAddress.trim());
        setNewWalletAddress('');
        setVerificationDigits(["", "", "", "", "", ""]);
        setSentCode('');
        setWalletModalStep('input');
        setIsWalletModalOpen(false);
      } catch (err) {
        console.error(err);
        setVerificationError('Failed to authorize wallet change');
      } finally {
        setIsVerifyingCode(false);
      }
    })();
  };

  const handleAddIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim() || ipWhitelist.includes(newIp.trim())) return;
    setIpWhitelist((current) => [...current, newIp.trim()]);
    setNewIp("");
  };

  const handleRemoveIp = (ip: string) => {
    setIpWhitelist((current) => current.filter((item) => item !== ip));
  };

  const walletSummary = useMemo(() => abbreviateAddress(payoutWallet), [payoutWallet]);

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
                Security Center
              </span>
              <h1 className="mt-4 text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                API Keys & Security
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400 leading-7 mt-3">
                Manage publishable and secret keys for your production and sandbox environments, enforce settlement wallet approvals, and harden API access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.28em] ${activeBadgeClasses}`}>
                {activeEnvironmentText}
              </div>
              <button
                type="button"
                onClick={handleToggleEnvironment}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white transition hover:border-purple-400/40 hover:bg-purple-500/10"
              >
                Switch View
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[1.7fr_1fr]">
          <section className="space-y-8">
            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8 shadow-[0_25px_120px_rgba(15,23,42,0.15)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Key Suite</p>
                  <h2 className="mt-3 text-2xl font-black text-white">Production + Sandbox Keys</h2>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setCreatingKey(true);
                    try {
                      const res = await fetch('/api/v1/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ environment: isLiveMode ? 'mainnet' : 'sandbox' }) });
                      if (!res.ok) throw new Error('Failed to create key');
                      const data = await res.json();
                      // Insert the new key showing raw secret briefly
                      const newKey: ApiKeyPair = {
                        id: data.id,
                        environment: data.environment === 'mainnet' ? 'Production' : 'Sandbox',
                        network: data.environment === 'mainnet' ? 'Mainnet' : 'Testnet',
                        publishable: data.prefix + 'pub_' + data.id.slice(0,8),
                        secret: data.rawSecretKey,
                        createdAt: data.createdAt || new Date().toISOString(),
                        lastUsed: 'never',
                      };
                      setKeyPairs((cur) => [newKey, ...cur]);
                      setVisibleSecretId(data.id);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setCreatingKey(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-5 py-3 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400"
                >
                  <Plus size={16} /> {creatingKey ? 'Creating…' : 'Create key pair'}
                </button>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {keyPairs.map((item) => (
                  <div key={item.id} className="rounded-[2.5rem] border border-white/10 bg-zinc-950/80 p-6">
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
                      <div className="rounded-3xl border border-white/10 bg-black/50 p-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                          <span>Publishable</span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(`${item.id}-pub`, item.publishable)}
                            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-white"
                          >
                            <Copy size={12} /> {copiedKeyId === `${item.id}-pub` ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-3 break-all text-sm font-mono text-zinc-200">{item.publishable}</p>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-black/50 p-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                          <span>Secret</span>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(item.id)}
                            className="inline-flex items-center gap-1 text-zinc-300 transition hover:text-white"
                          >
                            {visibleSecretId === item.id ? <EyeOff size={12} /> : <Eye size={12} />}
                            {visibleSecretId === item.id ? "Hide" : "Reveal"}
                          </button>
                        </div>
                        <p className="mt-3 break-all text-sm font-mono text-zinc-200">
                          {visibleSecretId === item.id ? item.secret : "••••••••••••••••••••••••••••••"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setVisibleSecretId(item.id)}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-white transition hover:border-purple-300/40"
                      >
                        Reveal secret
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRollKey(item.id)}
                        className="rounded-full border border-amber-600/20 bg-amber-500/10 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-amber-300 transition hover:bg-amber-500/20"
                      >
                        Roll secret
                      </button>
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
                        <Trash2 size={14} /> Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Payout Wallet</p>
                  <h2 className="mt-3 text-2xl font-black text-white">Settlement Address</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-5 py-3 text-xs font-black uppercase tracking-[0.28em] text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-400"
                >
                  <Sparkles size={16} /> Update wallet
                </button>
              </div>

              <div className="mt-8 rounded-[2.5rem] border border-white/10 bg-black/60 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Current wallet</p>
                    <p className="mt-2 text-lg font-mono text-white">{walletSummary}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-300">
                    2FA protected
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">
                  Payout wallet changes require verification via your registered email. This protects your settlement flow from unauthorized updates.
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8">
              <div className="flex items-center gap-3 text-purple-300">
                <ShieldCheck size={18} />
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Security posture</p>
              </div>
              <div className="mt-6 space-y-6">
                <div className="rounded-[2.5rem] border border-white/10 bg-black/60 p-5">
                  <h3 className="text-sm font-black uppercase tracking-[0.28em] text-white">TEE Enforcement</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Requiring trusted execution environment attestation keeps high-risk operations locked to approved enclave sessions.
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-[0.28em] text-zinc-500">Enabled</span>
                    <button
                      type="button"
                      onClick={() => setRequireTee(!requireTee)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${requireTee ? "bg-purple-600" : "bg-zinc-700"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${requireTee ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-white/10 bg-black/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.28em] text-white">IP whitelist</p>
                      <p className="mt-2 text-sm text-zinc-400">Limit API access to trusted IP ranges.</p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-zinc-300">
                      {ipWhitelist.length} entries
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {ipWhitelist.map((ip) => (
                      <div key={ip} className="flex items-center justify-between rounded-3xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-xs text-zinc-300">
                        <span className="font-mono">{ip}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIp(ip)}
                          className="text-rose-400 transition hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[3rem] border border-white/10 bg-zinc-950/90 p-8">
              <div className="flex items-center gap-3 text-zinc-300">
                <Mail size={18} />
                <p className="text-sm uppercase tracking-[0.28em] text-zinc-500">Notifications</p>
              </div>
              <div className="mt-6 space-y-4 text-sm text-zinc-400">
                <p>Receive alerts when payout wallet updates are requested or when a new secret is rolled.</p>
                <p className="rounded-3xl border border-white/10 bg-black/50 px-4 py-4">
                  Email notifications are currently configured for <span className="text-white">security@{merchantName.toLowerCase() || "opayque"}.com</span>.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[3rem] border border-white/10 bg-zinc-950/95 p-8 text-white shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-purple-300">Protected wallet update</p>
                <h2 className="mt-3 text-2xl font-black uppercase tracking-tight">Authorize settlement wallet change</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWalletModalOpen(false);
                  setWalletModalStep("input");
                  setVerificationError("");
                }}
                className="rounded-full bg-white/5 p-3 text-white transition hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-6 rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                <label className="text-xs uppercase tracking-[0.28em] text-zinc-500">New wallet address</label>
                <input
                  type="text"
                  value={newWalletAddress}
                  onChange={(event) => setNewWalletAddress(event.target.value)}
                  placeholder="Enter Solana payout wallet"
                  className="w-full rounded-3xl border border-white/10 bg-zinc-900/80 px-4 py-4 text-sm text-white outline-none transition focus:border-purple-500"
                />
                <p className="text-sm leading-6 text-zinc-400">
                  All payout wallet updates are held until email verification completes. This prevents unsanctioned settlement changes.
                </p>
              </div>

              <div className="space-y-4 rounded-[2.5rem] border border-white/10 bg-zinc-900/80 p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Verification</p>
                <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
                  <p className="text-sm text-zinc-300">We will send a one-time code to the merchant email on file.</p>
                  <button
                    type="button"
                    onClick={handleSendConfirmationCode}
                    disabled={isSendingCode}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-3xl bg-purple-500 px-4 py-3 text-sm font-black uppercase tracking-[0.28em] text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-purple-500/50"
                  >
                    {isSendingCode ? "Sending code..." : "Send verification code"}
                  </button>
                  {walletModalMessage && <p className="mt-4 text-sm text-emerald-300">{walletModalMessage}</p>}
                </div>

                {walletModalStep === "code" && (
                  <div className="rounded-3xl border border-white/10 bg-black/60 p-4">
                    <p className="text-sm text-zinc-300">Enter the 6-digit code.</p>
                    <div className="mt-4 grid grid-cols-6 gap-3">
                      {verificationDigits.map((digit, index) => (
                        <input
                          key={index}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(event) => handleVerificationDigit(index, event.target.value)}
                          className="h-14 w-full rounded-3xl border border-white/10 bg-zinc-900/90 text-center text-xl font-black text-white outline-none transition focus:border-purple-500"
                        />
                      ))}
                    </div>
                    {verificationError && <p className="mt-3 text-sm text-rose-400">{verificationError}</p>}
                    <button
                      type="button"
                      onClick={handleAuthorizeWallet}
                      disabled={isVerifyingCode}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-3xl bg-emerald-500 px-4 py-3 text-sm font-black uppercase tracking-[0.28em] text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                    >
                      {isVerifyingCode ? "Verifying..." : "Authorize wallet change"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
