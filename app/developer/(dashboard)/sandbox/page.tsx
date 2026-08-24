"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Play, QrCode, ShieldCheck, Terminal } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { isRealMerchantId } from "@/lib/terminal/guards";

interface MerchantProfile {
  id: string;
  merchant_name?: string | null;
  settlement_wallet_address?: string | null;
}

interface ConsoleLog {
  timestamp: string;
  type: "info" | "success" | "error";
  message: string;
}

function shortAddress(value: string) {
  return value.length > 10 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function maskApiKey(value: string) {
  return value.length > 12 ? `${value.slice(0, 12)}...${value.slice(-4)}` : "Configured test key";
}

function readSandboxKey() {
  if (typeof window === "undefined") return "";
  try {
    const cached = JSON.parse(window.localStorage.getItem("opayque_api_keys") || "[]");
    if (!Array.isArray(cached)) return "";
    const candidate = cached.find((key) =>
      typeof key?.secret === "string" && key.secret.startsWith("osk_test_")
    );
    return candidate?.secret || "";
  } catch {
    return "";
  }
}

export default function DeveloperSandbox() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [orderId, setOrderId] = useState(() => `ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState("15.00");
  const [isLoading, setIsLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  const addLog = (message: string, type: ConsoleLog["type"] = "info") => {
    setLogs((current) => [
      { timestamp: new Date().toLocaleTimeString(), type, message },
      ...current,
    ].slice(0, 20));
  };

  const loadMerchant = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/merchant", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.merchant || !isRealMerchantId(payload.merchant.id)) {
        throw new Error(response.status === 401 ? "Log in to use the developer sandbox." : "Merchant profile is unavailable.");
      }

      const loadedMerchant = payload.merchant as MerchantProfile;
      setMerchant(loadedMerchant);
      addLog(`Merchant loaded: ${shortAddress(loadedMerchant.id)}`);
      if (loadedMerchant.settlement_wallet_address?.trim()) {
        addLog(`Settlement wallet: ${shortAddress(loadedMerchant.settlement_wallet_address.trim())}`);
      } else {
        addLog("Settlement wallet is not configured.", "error");
      }

      const loadedKey = readSandboxKey();
      setApiKey(loadedKey);
      addLog(loadedKey ? `Test key present: ${maskApiKey(loadedKey)}` : "No test API key found.", loadedKey ? "success" : "error");
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load merchant profile.";
      setError(message);
      addLog(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMerchant();
  }, []);

  const wallet = merchant?.settlement_wallet_address?.trim() || "";
  const numericAmount = Number(amount);
  const canLaunch = Boolean(
    !isLoading &&
    !isLaunching &&
    isRealMerchantId(merchant?.id) &&
    wallet &&
    apiKey.startsWith("osk_test_") &&
    orderId.trim() &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0
  );

  const statusLabel = useMemo(() => {
    if (isLoading) return "Loading merchant context";
    if (error) return "Action required";
    if (!wallet || !apiKey) return "Configuration required";
    return "Sandbox ready";
  }, [apiKey, error, isLoading, wallet]);

  const copyValue = async (value: string, kind: "key" | "url") => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const launchSandbox = async () => {
    if (!canLaunch) return;
    setIsLaunching(true);
    setError(null);
    setPaymentUrl("");
    setSessionId("");
    addLog("Creating sandbox checkout session...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          order_id: orderId.trim(),
          amount_fiat: numericAmount,
          currency: "USDC",
          description: "Sandbox test payment",
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      const resolvedSessionId = data?.session_id ?? data?.payment_intent_id ?? data?.data?.session_id;
      const resolvedPaymentUrl = data?.payment_url ?? data?.data?.payment_url;
      if (!response.ok || !resolvedSessionId || !resolvedPaymentUrl) {
        throw new Error(data?.error || "The sandbox session could not be created.");
      }

      setSessionId(String(resolvedSessionId));
      setPaymentUrl(String(resolvedPaymentUrl));
      addLog(`Session created: ${shortAddress(String(resolvedSessionId))}`, "success");
      addLog("Payment URL is ready.", "success");
      window.open(String(resolvedPaymentUrl), "_blank", "noopener,noreferrer");
      addLog("Checkout opened in a new tab.", "success");
    } catch (launchError) {
      const message = launchError instanceof DOMException && launchError.name === "AbortError"
        ? "Session request timed out. Try again."
        : launchError instanceof Error ? launchError.message : "The sandbox session could not be created.";
      setError(message);
      addLog(message, "error");
    } finally {
      window.clearTimeout(timeout);
      setIsLaunching(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_38%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <div className="w-full rounded-[3rem] border border-white/10 bg-zinc-950/95 p-6 shadow-2xl sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300"><Terminal size={15} /> Devnet Sandbox</div>
              <h1 className="text-4xl font-black uppercase tracking-tighter sm:text-5xl">Sandbox Checkout</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Create a real test session and open the same hosted checkout used by the staff terminal.</p>
            </div>
            <button type="button" onClick={() => router.push("/developer/overview")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 hover:bg-white/10"><ArrowLeft size={14} /> Close</button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="rounded-[2rem] border border-white/10 bg-black/50 p-5"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Order ID</span><input value={orderId} onChange={(event) => setOrderId(event.target.value)} className="mt-3 w-full bg-transparent font-mono text-sm text-white outline-none" /></label>
                <label className="rounded-[2rem] border border-white/10 bg-black/50 p-5"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Amount USDC</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-3 w-full bg-transparent font-mono text-sm text-white outline-none" /></label>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Merchant context</p><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><p className="text-zinc-400">Merchant <span className="font-mono text-purple-300">{merchant ? shortAddress(merchant.id) : "Loading..."}</span></p><p className="text-zinc-400">Wallet <span className="font-mono text-purple-300">{wallet ? shortAddress(wallet) : "Not configured"}</span></p></div></div>

              <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5"><div className="flex items-center justify-between gap-4"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Test API key</p>{apiKey && <button type="button" onClick={() => void copyValue(apiKey, "key")} className="text-zinc-400 hover:text-white" aria-label="Copy test API key">{copied === "key" ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}</button>}</div><p className="mt-3 font-mono text-sm text-zinc-300">{apiKey ? maskApiKey(apiKey) : "Not configured"}</p>{!apiKey && <p className="mt-2 text-xs text-zinc-500">Create a sandbox key in API Keys, then return here.</p>}</div>

              {(error || !wallet || !apiKey) && !isLoading && <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-200"><p>{error || (!wallet ? "Add a settlement wallet before launching a checkout." : "Create a sandbox API key before launching a checkout.")}</p><button type="button" onClick={() => router.push("/developer/keys")} className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-purple-300 underline underline-offset-4">Open API Keys</button></div>}

              <button type="button" onClick={() => void launchSandbox()} disabled={!canLaunch} className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-purple-600 px-6 py-5 text-sm font-black uppercase tracking-[0.25em] text-white shadow-[0_0_24px_rgba(168,85,247,0.25)] transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40">{isLaunching ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}{isLaunching ? "Creating session..." : "Launch Sandbox"}</button>

              {paymentUrl && <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-5"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">Checkout ready</p><p className="mt-2 font-mono text-xs text-zinc-300">Session {shortAddress(sessionId)}</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => void copyValue(paymentUrl, "url")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">{copied === "url" ? <Check size={13} /> : <Copy size={13} />} Copy URL</button><a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">Open checkout <ExternalLink size={13} /></a></div></div>}
            </section>

            <aside className="flex min-h-[420px] flex-col rounded-[2.5rem] border border-white/10 bg-black/70 p-6"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3 text-purple-300"><ShieldCheck size={18} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">Sandbox status</span></div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{statusLabel}</span></div>{paymentUrl ? <div className="flex flex-1 flex-col items-center justify-center gap-4"><div className="rounded-[2rem] bg-white p-5"><QRCodeSVG value={paymentUrl} size={190} level="M" /></div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500"><QrCode size={14} /> Hosted checkout URL</div></div> : <div className="mt-5 flex-1 space-y-3 overflow-y-auto text-[11px] leading-5">{logs.length === 0 ? <p className="text-zinc-600">Loading merchant context...</p> : logs.map((log, index) => <div key={`${log.timestamp}-${index}`} className="border-b border-white/5 pb-2"><span className="mr-2 text-zinc-600">[{log.timestamp}]</span><span className={log.type === "success" ? "text-emerald-300" : log.type === "error" ? "text-amber-300" : "text-purple-200"}>{log.message}</span></div>)}</div>}{paymentUrl && <div className="mt-5 border-t border-white/10 pt-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Checkout opened successfully</div>}</aside>
          </div>
        </div>
      </div>
    </main>
  );
}
