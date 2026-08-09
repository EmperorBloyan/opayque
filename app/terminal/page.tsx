"use client";

import { FormEvent, useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LucideBell, LucideX } from "lucide-react";
import { createSessionChallenge, createTerminalSession, getActiveMerchantId, getActiveSession, setActiveSession } from "@/lib/crypto/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TransactionRecord } from "@/types/database";

interface TerminalNotification {
  id: string;
  amount: number;
  asset: string;
  walletSnippet: string;
  status: string;
  createdAt: number;
}

const NOTIFICATION_STORAGE_KEY = "opayque_terminal_notifications";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function normalizePairingCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function loadStoredNotifications() {
  if (typeof window === "undefined") return [] as TerminalNotification[];

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as TerminalNotification[]) : [];
    return parsed.filter((item) => Date.now() - item.createdAt < ONE_DAY_MS);
  } catch {
    return [];
  }
}

function saveStoredNotifications(items: TerminalNotification[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore storage failures.
  }
}

/*
export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalToken, setTerminalToken] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [latestTxHash, setLatestTxHash] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"USDC" | "USDT" | "SOL">("USDC");
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [merchantName, setMerchantName] = useState("Opayque Merchant");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState<string>("");
  const [merchantName, setMerchantName] = useState<string>("Opayque");
  const [notifications, setNotifications] = useState<TerminalNotification[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [settledDetails, setSettledDetails] = useState<{ amount: number; walletSnippet: string; asset: string } | null>(null);

  const pairingRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const activeSession = getActiveSession();

  function createDefaultTerminalLabelLocal() {
    try {
      const short = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, "").slice(0, 6).toUpperCase();
      return `Terminal-${short}`;
    } catch {
      return `Terminal-${Date.now()}`;
    "use client";

    import { FormEvent, useState, useEffect, useCallback, useRef } from "react";
    import { QRCodeSVG } from "qrcode.react";
    import { Connection } from "@solana/web3.js";
    import { LucideBell, LucideX } from "lucide-react";
    import { createSessionChallenge, createTerminalSession, getActiveMerchantId, getActiveSession, setActiveSession } from "@/lib/crypto/session";
    import { createSupabaseBrowserClient } from "@/lib/supabase/client";
    import type { TransactionRecord } from "@/types/database";

    interface TerminalNotification {
      id: string;
      amount: number;
      asset: string;
      walletSnippet: string;
      status: string;
      createdAt: number;
    }

    const NOTIFICATION_STORAGE_KEY = "opayque_terminal_notifications";
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    function normalizePairingCode(value: string) {
      return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    function loadStoredNotifications() {
      if (typeof window === "undefined") return [] as TerminalNotification[];

      try {
        const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as TerminalNotification[]) : [];
        return parsed.filter((item) => Date.now() - item.createdAt < ONE_DAY_MS);
      } catch {
        return [];
      }
    }

    function saveStoredNotifications(items: TerminalNotification[]) {
      if (typeof window === "undefined") return;

      try {
        window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
        window.dispatchEvent(new Event("storage"));
      } catch {
        // Ignore storage failures.
      }
    }

  */
  export default function TerminalPage() {
      const [mounted, setMounted] = useState(false);
      const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
      const [terminalId, setTerminalId] = useState<string | null>(null);
      const [terminalToken, setTerminalToken] = useState<string | null>(null);
      const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
      const [latestTxHash, setLatestTxHash] = useState<string | null>(null);
      const [pairingCode, setPairingCode] = useState("");
      const [amount, setAmount] = useState("");
      const [asset, setAsset] = useState<"USDC" | "USDT" | "SOL">("USDC");
      const [isPaid, setIsPaid] = useState(false);
      const [toast, setToast] = useState<string | null>(null);
      const [transactionId, setTransactionId] = useState<string | null>(null);
      const [merchantName, setMerchantName] = useState<string>("Opayque");
      const [notifications, setNotifications] = useState<TerminalNotification[]>([]);
      const [isBellOpen, setIsBellOpen] = useState(false);
      const [settledDetails, setSettledDetails] = useState<{ amount: number; walletSnippet: string; asset: string } | null>(null);

      const pairingRef = useRef<HTMLInputElement | null>(null);
      const successRef = useRef<HTMLDivElement | null>(null);
      const activeSession = getActiveSession();

      function createDefaultTerminalLabelLocal() {
        try {
          const short = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, "").slice(0, 6).toUpperCase();
          return `Terminal-${short}`;
        } catch {
          return `Terminal-${Date.now()}`;
        }
      }

      const numericAmount = Number(amount);
      const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount < 1_000_000;

      const formatWalletSnippet = (walletAddress: string) => {
        if (!walletAddress || walletAddress.length <= 8) return walletAddress;
        return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
      };

      const addNotification = useCallback(
        (record: TransactionRecord) => {
          const walletSnippet = formatWalletSnippet(activeSession?.walletAddress ?? "");
          const nextNotification: TerminalNotification = {
            id: record.id,
            amount: record.amount,
            asset: record.token_symbol,
            walletSnippet,
            status: record.status,
            createdAt: Date.now(),
          };

          setNotifications((current) => {
            const fresh = current.filter((item) => Date.now() - item.createdAt < ONE_DAY_MS);
            const next = [nextNotification, ...fresh].slice(0, 20);
            saveStoredNotifications(next);
            return next;
          });
        },
        [activeSession?.walletAddress]
      );

      const buildUri = useCallback(() => {
        try {
          const session = getActiveSession();
          const recipient = typeof session?.walletAddress === "string" ? session.walletAddress.trim() : "";
          const amountValue = amount || "";
          const normalizedAmount = Number.parseFloat(String(amountValue).trim());
          const resolvedAmount = Number.isFinite(normalizedAmount) && normalizedAmount > 0 ? normalizedAmount.toFixed(2) : undefined;

          if (!recipient || !resolvedAmount) {
            return "";
          }

          const origin = typeof window !== "undefined" ? window.location.origin : "https://opayque.vercel.app";
          const checkoutUrl = new URL("/checkout", origin);
          checkoutUrl.searchParams.set("address", recipient);
          checkoutUrl.searchParams.set("amount", resolvedAmount);
          checkoutUrl.searchParams.set("name", merchantName || "Opayque Merchant");
          if (transactionId) {
            checkoutUrl.searchParams.set("tx_id", transactionId);
          }

          return checkoutUrl.toString();
        } catch (error) {
          console.error("Failed to build checkout URL", error);
          return "";
        }
      }, [amount, merchantName, transactionId]);

      const handlePairing = async (e: FormEvent) => {
        e.preventDefault();
        if (typeof window === "undefined") {
          setToast("Window context is unavailable for pairing.");
          return;
        }

        const normalizedCode = normalizePairingCode(pairingCode || "");
        if (!normalizedCode) {
          setToast("Enter a pairing code");
          return;
        }

        setToast("Pairing terminal...");

        try {
          const supabase = createSupabaseBrowserClient();
          const merchantId = getActiveMerchantId();
          let terminalRows: Array<{ id: string; device_token?: string | null; status?: string | null; merchant_id?: string | null; terminal_label?: string | null }> = [];

          const merchantCandidates = [merchantId, "merchant-vault"].filter(Boolean);

          for (const candidateMerchantId of merchantCandidates) {
            const { data, error: listError } = await supabase
              .from("terminals")
              .select("id, device_token, status, merchant_id, terminal_label")
              .eq("merchant_id", candidateMerchantId);

            if (listError) {
              throw listError;
            }

            if (data && data.length > 0) {
              terminalRows = data as Array<{ id: string; device_token?: string | null; status?: string | null; merchant_id?: string | null; terminal_label?: string | null }>;
              break;
            }
          }

          if (!terminalRows || terminalRows.length === 0) {
            const { data: fallbackRows, error: fallbackError } = await supabase.from("terminals").select("id, device_token, status, merchant_id, terminal_label");
            if (fallbackError) throw fallbackError;
            terminalRows = (fallbackRows ?? []) as Array<{ id: string; device_token?: string | null; status?: string | null; merchant_id?: string | null; terminal_label?: string | null }>;
          }

          const matchedTerminal = terminalRows.find((terminal) => normalizePairingCode(String(terminal.device_token ?? "")) === normalizedCode);
          if (!matchedTerminal) {
            throw new Error("Pairing code rejected");
          }

          const resultingMerchantName = matchedTerminal.terminal_label || matchedTerminal.merchant_id || "Opayque";
          setMerchantName(resultingMerchantName);

          await supabase.from("terminals").update({ status: "online", last_active: new Date().toISOString() }).eq("id", matchedTerminal.id);

          // Create a terminal session for local pairing
          const challenge = createSessionChallenge();
          const session = await createTerminalSession({
            merchantId: matchedTerminal.merchant_id ?? getActiveMerchantId(),
            walletAddress: matchedTerminal.merchant_id ?? "",
            nonce: challenge.nonce,
            walletSignature: new TextEncoder().encode(`terminal-pair:${matchedTerminal.merchant_id ?? ''}`),
          });

          setActiveSession(session);

          // Persist terminal record locally
          try {
            const resp = await fetch(`/api/terminal/pair`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ merchant_id: session.merchantId, terminal_label: matchedTerminal.terminal_label ?? createDefaultTerminalLabelLocal() }),
            });
            const body = await resp.json().catch(() => null);
            if (resp.ok && body?.success && body?.data?.terminal) {
              const t = body.data.terminal as any;
              const deviceToken = body.data.device_token ?? null;
              try {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("opayque_terminal_id", String(t.id));
                  if (deviceToken) window.localStorage.setItem("opayque_terminal_token", String(deviceToken));
                  window.localStorage.setItem("opayque_terminal_label", String(t.terminal_label ?? matchedTerminal.terminal_label ?? createDefaultTerminalLabelLocal()));
                }
              } catch {}
              setTerminalId(String(t.id));
              setTerminalToken(deviceToken ?? null);
            }
          } catch (err) {
            console.warn("Failed to persist terminal pairing", err);
          }

          setStep("POS");
          setToast("Terminal paired successfully");
        } catch (error) {
          console.error("Pairing error:", error);
          setToast(error instanceof Error ? error.message : "Pairing failed");
        }
      };

      const generateNewPayment = async () => {
        if (!isAmountValid) return;
        try {
          const supabase = createSupabaseBrowserClient();
          const merchantId = activeSession?.merchantId ?? null;
          const { data, error } = await supabase
            .from("transactions")
            .insert({ merchant_id: merchantId, terminal_id: terminalId ?? null, signature: null, token_symbol: asset, amount: numericAmount, status: "pending" })
            .select()
            .single();

          if (error || !data) throw new Error(error?.message || "Failed to create pending transaction");

          setTransactionId((data as TransactionRecord).id);
          setLatestTxHash(null);
          setIsPaid(false);
          try {
            if (typeof window !== "undefined") window.localStorage.setItem("opayque_pending_tx_id", String((data as TransactionRecord).id));
          } catch {}
          setAmount("");
          setStep("PAYING");
          setPaymentStatus("PENDING");
          setToast("Pending transaction created");
        } catch (err) {
          setToast(err instanceof Error ? err.message : "Failed to create transaction");
        }
      };

      const resetPaymentFlow = useCallback(() => {
        setStep("POS");
        setIsPaid(false);
        setAmount("");
        setTransactionId(null);
        setPaymentStatus(null);
        setLatestTxHash(null);
        try {
          if (typeof window !== "undefined") window.localStorage.removeItem("opayque_pending_tx_id");
        } catch {}
      }, []);

      const handleGenerateQR = async () => {
        await generateNewPayment();
      };

      const playPaymentConfirmationTone = useCallback(() => {
        if (typeof window === "undefined") return;
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.value = 440;
          osc.connect(gain);
          gain.connect(ctx.destination);

          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.35);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
            void ctx.close();
          };
        } catch (error) {
          console.warn("Unable to play payment sound", error);
        }
      }, []);

      useEffect(() => {
        setMounted(true);
        setNotifications(loadStoredNotifications());
        if (activeSession) setStep("POS");

        const hydrateTerminal = async () => {
          if (typeof window === "undefined") return;

          const persistedPendingTxId = window.localStorage.getItem("opayque_pending_tx_id")?.trim() || null;
          if (persistedPendingTxId) {
            try {
              const supabase = createSupabaseBrowserClient();
              const { data: storedRow, error: err } = await supabase.from("transactions").select("*").eq("id", persistedPendingTxId).single();
              if (!err && storedRow) {
                if (storedRow.terminal_id) setTerminalId(String(storedRow.terminal_id));
                setTransactionId(String(storedRow.id));
                setLatestTxHash(null);
                setIsPaid(String(storedRow.status ?? "").toLowerCase() === "settled");
                setAmount("");
                setStep("PAYING");
                return;
              }
            } catch (err) {
              console.warn("Failed to restore pending transaction", err);
            }

            try { window.localStorage.removeItem("opayque_pending_tx_id"); } catch {}
          }

          const storedId = window.localStorage.getItem("opayque_terminal_id")?.trim() || null;
          const supabase = createSupabaseBrowserClient();
          const session = getActiveSession();

          if (storedId) {
            try {
              const { data, error } = await supabase.from("terminals").select("*").eq("id", storedId).single();
              if (!error && data) {
                setTerminalId(String(data.id));
                setStep("POS");
                return;
              }
            } catch (err) {
              console.warn("Failed to validate stored terminal", err);
            }
          }

          if (session && session.merchantId) {
            try {
              const { data, error } = await supabase.from("terminals").select("*").eq("merchant_id", session.merchantId).order("last_active", { ascending: false }).limit(1);
              if (!error && Array.isArray(data) && data.length > 0) {
                const row = data[0] as any;
                setTerminalId(String(row.id));
                try {
                  window.localStorage.setItem("opayque_terminal_id", String(row.id));
                  if (row.device_token) window.localStorage.setItem("opayque_terminal_token", String(row.device_token));
                } catch {}
                setStep("POS");
                return;
              }
            } catch (err) {
              console.warn("Failed to load merchant terminals", err);
            }
          }

          setStep("PAIRING");
        };

        void hydrateTerminal();
      }, []);

      useEffect(() => {
        if (!transactionId) return;

        const supabase = createSupabaseBrowserClient();
        const channel = supabase
          .channel(`transactions:${transactionId}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${transactionId}` }, (payload) => {
            const record = payload.new as TransactionRecord | null;
            if (!record?.status) return;

            setToast(`Transaction status: ${record.status}`);

            const normalizedStatus = String(record.status).toLowerCase();
            if (normalizedStatus === "confirmed" || normalizedStatus === "settled") {
              const amount = Number(record.amount ?? numericAmount);
              const walletSnippet = formatWalletSnippet(activeSession?.walletAddress ?? "");
              setSettledDetails({ amount, walletSnippet, asset: record.token_symbol });
              addNotification(record);
              setPaymentStatus("SETTLED");
              setLatestTxHash((record as any).tx_hash ?? (record as any).signature ?? null);
              setIsPaid(true);
              playPaymentConfirmationTone();
              requestAnimationFrame(() => successRef.current?.focus());
            }
          })
          .subscribe();

        return () => void supabase.removeChannel(channel);
      }, [transactionId, addNotification, activeSession?.walletAddress, numericAmount, asset]);

      useEffect(() => {
        if (!terminalId) return;

        const restoreLatestTransaction = async () => {
          try {
            const supabase = createSupabaseBrowserClient();
            const { data, error } = await supabase.from("transactions").select("*").eq("terminal_id", terminalId).order("created_at", { ascending: false }).limit(1).single();
            if (error || !data) return;

            const status = String(data.status ?? "pending").toLowerCase();
            const restoredId = String(data.id);
            const resolvedAmount = Number(data.amount ?? 0);

            setTransactionId(restoredId);
            setAmount("");
            setStep("PAYING");
            setPaymentStatus(status.toUpperCase());
            setLatestTxHash((data as any).tx_hash ?? (data as any).signature ?? null);
            setIsPaid(status === "settled");
          } catch (error) {
            console.warn("Failed to restore terminal transaction state", error);
          }
        };

        void restoreLatestTransaction();

        const supabase = createSupabaseBrowserClient();
        const channel = supabase
          .channel(`terminal-${terminalId}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions", filter: `terminal_id=eq.${terminalId}` }, (payload) => {
            const rec = payload.new as TransactionRecord | null;
            if (!rec) return;
            if (rec.status === "settled") {
              setPaymentStatus("SETTLED");
              setLatestTxHash((rec as any).tx_hash ?? (rec as any).signature ?? null);
              setIsPaid(true);
              setStep("PAYING");
              setToast("Transaction settled on-chain");
              playPaymentConfirmationTone();
              requestAnimationFrame(() => successRef.current?.focus());
            } else {
              setPaymentStatus(String(rec.status ?? "PENDING").toUpperCase());
              setIsPaid(false);
            }
          })
          .subscribe();

        return () => void supabase.removeChannel(channel);
      }, [terminalId]);

      const unpairTerminal = async () => {
        try {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("opayque_terminal_id");
            window.localStorage.removeItem("opayque_terminal_token");
            window.localStorage.removeItem("opayque_terminal_label");
          }
          setTerminalId(null);
          setTerminalToken(null);
          setStep("PAIRING");
          setToast("Terminal unpaired");
        } catch (err) {
          console.error("Failed to unpair terminal", err);
        }
      };

      if (!mounted) return null;

      const qrUri = buildUri();
      const openCount = notifications.filter((item) => Date.now() - item.createdAt < ONE_DAY_MS).length;

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md relative">
            <div className="absolute right-0 top-0 flex items-center gap-3">
              <button type="button" onClick={() => setIsBellOpen((prev) => !prev)} className="relative inline-flex items-center justify-center h-11 w-11 rounded-3xl border border-white/10 bg-zinc-950/80 text-white transition hover:border-white/20" aria-label="Transaction notifications">
                <LucideBell size={20} />
                {openCount > 0 ? <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-black">{openCount}</span> : null}
              </button>
            </div>

            {isBellOpen && (
              <div className="absolute right-0 top-14 z-20 w-[320px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Transaction activity</p>
                    <h2 className="text-base font-black">Recent settlements</h2>
                  </div>
                  <button type="button" onClick={() => setIsBellOpen(false)} className="text-zinc-400 hover:text-white"><LucideX size={18} /></button>
                </div>
                <div className="space-y-3">
                  {notifications.length === 0 ? <p className="text-sm text-zinc-500">No activity in the last 24 hours.</p> : notifications.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4">
                      <div className="flex items-center justify-between text-sm uppercase tracking-[0.3em] text-zinc-500"><span>{item.asset}</span><span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                      <p className="mt-2 text-lg font-black">{item.amount.toFixed(2)}</p>
                      <p className="mt-1 text-sm text-zinc-400">From {item.walletSnippet}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === "PAIRING" && (
              <form onSubmit={handlePairing} className="text-center">
                <input ref={pairingRef} aria-label="Pairing Code" inputMode="text" type="text" maxLength={12} placeholder="Enter pairing code" value={pairingCode} onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 12))} className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-4xl font-mono font-black outline-none mb-6" />
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Use the generated fleet code to unlock the staff terminal.</p>
                <button type="submit" className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest">Pair Device</button>
              </form>
            )}

            {step === "POS" && (
              <div className="text-center">
                <input aria-label="Transaction Amount" inputMode="decimal" type="text" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full" />
                <button onClick={handleGenerateQR} disabled={!isAmountValid} className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl disabled:opacity-20 uppercase tracking-tighter">Generate New Payment</button>
              </div>
            )}

            {step === "PAYING" && (
              <div className="text-center">
                {!isPaid ? (
                  <div className="flex flex-col items-center">
                    {qrUri ? (<div className="p-10 bg-white rounded-[4rem] inline-block mb-4 border-[16px] border-zinc-900 shadow-2xl"><QRCodeSVG value={qrUri} size={220} level="H" /></div>) : (<div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-8 text-center"><p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Payment link unavailable</p><h3 className="mt-3 text-2xl font-black">We could not build a checkout link yet.</h3><p className="mt-2 text-sm text-zinc-400">Confirm the merchant wallet is available, then try again.</p></div>)}
                  </div>
                ) : (
                  <div ref={successRef} tabIndex={-1} aria-live="polite" className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mb-6"><span className="text-4xl italic font-black">✓</span></div>
                    <h2 className="text-5xl font-black italic uppercase">Settled</h2>
                    {settledDetails ? (<div className="mt-6 space-y-2 text-center"><p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{settledDetails.amount.toFixed(2)} {settledDetails.asset}</p><p className="text-sm text-zinc-300">From {settledDetails.walletSnippet}</p></div>) : (<p className="mt-4 text-sm text-zinc-500">Waiting for final settlement notification...</p>)}
                  </div>
                )}
              </div>
            )}

            {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase">{toast}</div>}
          </div>
        </div>
      );
    }