"use client";

import { Component, useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent, type ErrorInfo, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LucideEdit3 } from "lucide-react";
import { createSessionChallenge, createTerminalSession, getActiveMerchantId, getActiveSession, setActiveSession } from "@/lib/crypto/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createSupabaseBrowserClient as createSupabaseClient } from "@/lib/supabase/client";
import type { TransactionRecord } from "@/types/database";

interface TerminalPaymentErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface TerminalPaymentErrorBoundaryState {
  hasError: boolean;
}

class TerminalPaymentErrorBoundary extends Component<TerminalPaymentErrorBoundaryProps, TerminalPaymentErrorBoundaryState> {
  state: TerminalPaymentErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TerminalPaymentErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Terminal payment view crashed", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/90 p-8 text-center text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Payment unavailable</p>
          <h3 className="mt-3 text-2xl font-black">The payment view hit a temporary issue.</h3>
          <p className="mt-2 text-sm text-zinc-400">You can recover safely and return to the checkout screen.</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-black uppercase text-black"
          >
            Back to checkout
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const isAmountValid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount < 1_000_000;

  const buildUri = useCallback(() => {
    try {
      const recipient = typeof activeSession?.walletAddress === "string" ? activeSession.walletAddress.trim() : "";
      const amountValue = lockedAmount || amount || "";
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
  }, [activeSession?.walletAddress, amount, lockedAmount, merchantName]);

  const handlePairing = async (e: FormEvent) => {
    e.preventDefault();
    if (isPairing) return;

    const normalizedCode = pairingCode.trim();

    if (typeof window === "undefined") {
      setToast("Window context is unavailable for pairing.");
      return;
    }

    if (!normalizedCode) {
      setToast("Enter a pairing code");
      return;
    }

    setIsPairing(true);
    setToast("Pairing terminal...");

    try {
      const merchantId = activeSession?.merchantId;
      const activeWalletAddress = activeSession?.walletAddress;
      const response = await fetch("/api/terminal/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", merchant_id: merchantId, wallet_address: activeWalletAddress, code: normalizedCode }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        const message = payload?.error || `Pairing request failed with status ${response.status}`;
        throw new Error(message);
      }

      const resolvedMerchantId = typeof payload?.merchantId === "string" && payload.merchantId.trim()
        ? payload.merchantId.trim()
        : activeSession?.merchantId ?? null;
      const pairedWalletAddress = typeof payload?.walletAddress === "string" && payload.walletAddress.trim()
        ? payload.walletAddress.trim()
        : activeSession?.walletAddress ?? null;
      const resolvedMerchantName = typeof payload?.merchantName === "string" && payload.merchantName.trim()
        ? payload.merchantName.trim()
        : null;
      const resolvedMerchantLogo = typeof payload?.merchantLogo === "string" && payload.merchantLogo.trim()
        ? payload.merchantLogo.trim()
        : (typeof payload?.merchant_logo === "string" && payload.merchant_logo.trim()
          ? payload.merchant_logo.trim()
          : null);

      if (!resolvedMerchantId || resolvedMerchantId === "merchant-vault") {
        throw new Error("Merchant ID unavailable after pairing");
      }

      if (!pairedWalletAddress) {
        throw new Error("Merchant wallet address unavailable");
      }

      const challenge = createSessionChallenge();
      const session = await createTerminalSession({
        merchantId: resolvedMerchantId,
        walletAddress: pairedWalletAddress,
        nonce: challenge.nonce,
        walletSignature: new TextEncoder().encode(`terminal-pair:${resolvedMerchantId}`),
      });

      if (resolvedMerchantName) {
        setMerchantName(resolvedMerchantName);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("merchant_name", resolvedMerchantName);
        }
      }

      if (resolvedMerchantLogo) {
        setAvatarPreview(resolvedMerchantLogo);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("merchant_logo", resolvedMerchantLogo);
        }
      }

      const resolvedTerminalLabel = typeof payload?.terminalLabel === "string" && payload.terminalLabel.trim()
        ? payload.terminalLabel.trim()
        : createDefaultTerminalLabelLocal();

      setActiveSession(session);
      // Create terminal record and persist pairing locally
      try {
        const terminalLabel = createDefaultTerminalLabelLocal();
        const resp = await fetch(`/api/terminal/pair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchant_id: session.merchantId, terminal_label: resolvedTerminalLabel }),
        });

        const payload = await resp.json().catch(() => null);
        if (resp.ok && payload?.success && payload?.data?.terminal) {
          const t = payload.data.terminal as any;
          const deviceToken = payload.data.device_token ?? null;
          if (typeof window !== "undefined") {
            window.localStorage.setItem("opayque_terminal_id", String(t.id));
            if (deviceToken) window.localStorage.setItem("opayque_terminal_token", String(deviceToken));
            window.localStorage.setItem("opayque_terminal_label", String(t.terminal_label ?? terminalLabel));
          }
          setTerminalId(String(t.id));
          setTerminalToken(deviceToken ?? null);
        } else {
          console.warn("Terminal creation returned no terminal, continuing without local pairing.", payload);
        }
      } catch (err) {
        console.error("Failed to create terminal record", err);
      }

      setStep("POS");
      setToast("Terminal paired successfully");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setIsPairing(false);
    }
  };

  const generateNewPayment = async () => {
    if (!isAmountValid) return;
    try {
      const supabase = createSupabaseClient();
      const merchantId = activeSession?.merchantId ?? null;
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          merchant_id: merchantId,
          terminal_id: terminalId ?? null,
          signature: null,
          token_symbol: asset,
          amount: numericAmount,
          status: "pending",
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to create pending transaction");
      }

      setTransactionId((data as TransactionRecord).id);
      setLatestTxHash(null);
      setIsPaid(false);
      // Persist pending transaction so terminal survives refresh
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("opayque_pending_tx_id", String((data as TransactionRecord).id));
        }
      } catch {}
      setLockedAmount(numericAmount.toFixed(2));
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
    setLockedAmount("");
    setAmount("");
    setTransactionId(null);
    setPaymentStatus(null);
    setLatestTxHash(null);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("opayque_pending_tx_id");
      }
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

  const triggerSuccess = useCallback(async () => {
    // Deprecated: mock handler removed. Use real upstream confirmation via customer checkout
    return;
  }, [isPaid, isAmountValid]);

  useEffect(() => {
    setMounted(true);

    try {
      if (typeof window !== "undefined") {
        const savedName = window.localStorage.getItem("merchant_name")?.trim();
        const savedAvatar = window.localStorage.getItem("merchant_logo")?.trim() || window.localStorage.getItem("merchant_avatar")?.trim();
        if (savedName) {
          setMerchantName(savedName);
        }
        if (savedAvatar) {
          setAvatarPreview(savedAvatar);
        }
      }
    } catch (error) {
      console.warn("Unable to read merchant preferences from storage", error);
    }

    const persistedPendingTxId = typeof window !== "undefined" ? window.localStorage.getItem("opayque_pending_tx_id")?.trim() : null;
    if (persistedPendingTxId) {
      setTransactionId(persistedPendingTxId);
      setStep("PAYING");
      setPaymentStatus("PENDING");
    }

    // Hydrate terminal pairing from localStorage if present
    try {
      if (typeof window !== "undefined") {
        const storedId = window.localStorage.getItem("opayque_terminal_id")?.trim() || null;
        const storedToken = window.localStorage.getItem("opayque_terminal_token")?.trim() || null;
        if (storedId) {
          // validate terminal via Supabase
          const supabase = createSupabaseBrowserClient();
          (async () => {
            try {
              const { data, error } = await supabase.from("terminals").select("*").eq("id", storedId).single();
              if (!error && data) {
                if (!storedToken || String(data.device_token) === String(storedToken)) {
                  setTerminalId(storedId);
                  setTerminalToken(storedToken);
                  setStep("POS");
                } else {
                  // invalid token — clear pairing
                  window.localStorage.removeItem("opayque_terminal_id");
                  window.localStorage.removeItem("opayque_terminal_token");
                }
              }
            } catch (err) {
              console.warn("Failed to validate stored terminal", err);
            }
          })();
        }
      }
    } catch (err) {
      console.warn("Unable to hydrate stored terminal pairing", err);
    }
  }, [activeSession]);

  useEffect(() => {
    if (!transactionId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`transactions:${transactionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${transactionId}` },
        (payload) => {
          const record = payload.new as TransactionRecord | null;
          if (!record) return;
          const normalizedStatus = String(record.status ?? "").toLowerCase();
          if (normalizedStatus === "settled") {
            setPaymentStatus("SETTLED");
            setLatestTxHash((record as any).tx_hash ?? (record as any).signature ?? null);
            setIsPaid(true);
            setToast("Transaction settled on-chain");
            playPaymentConfirmationTone();
            requestAnimationFrame(() => {
              successRef.current?.focus();
            });
          } else if (record.status) {
            setToast(`Transaction status: ${record.status}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

  // Restore pending transaction or latest settled status for this terminal on load
  useEffect(() => {
    if (!terminalId) return;

    const supabase = createSupabaseBrowserClient();

    (async () => {
      try {
        // If there's a locally persisted pending tx id, prefer restoring it
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("opayque_pending_tx_id") : null;
        if (stored) {
          const { data: storedRow, error: err } = await supabase.from("transactions").select("*").eq("id", stored).single();
          if (!err && storedRow) {
            // If already settled, show settled state; otherwise restore PAYING with QR
            if (String(storedRow.status) === "settled") {
              setPaymentStatus("SETTLED");
              setLatestTxHash(storedRow.tx_hash ?? storedRow.signature ?? null);
              setIsPaid(true);
              setStep("PAYING");
            } else {
              setTransactionId(String(storedRow.id));
              setLatestTxHash(null);
              setIsPaid(false);
              setLockedAmount(String(Number(storedRow.amount ?? 0).toFixed(2)));
              setStep("PAYING");
              setPaymentStatus(String(storedRow.status ?? "pending"));
            }
            return;
          }
        }

        // Fallback: fetch the latest transaction for this terminal
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("terminal_id", terminalId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          const row = data[0] as any;
          if (String(row.status) === "settled") {
            setPaymentStatus("SETTLED");
            setLatestTxHash(row.tx_hash ?? row.signature ?? null);
            setIsPaid(true);
            setStep("PAYING");
          } else {
            setTransactionId(String(row.id));
            setLatestTxHash(null);
            setIsPaid(false);
            setLockedAmount(String(Number(row.amount ?? 0).toFixed(2)));
            setStep("PAYING");
            setPaymentStatus(String(row.status ?? "pending"));
            try {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("opayque_pending_tx_id", String(row.id));
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Failed to restore terminal transaction state", err);
      }
    })();

  }, [terminalId]);

  useEffect(() => {
    if (!terminalId) return;

    const restoreLatestTransaction = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("terminal_id", terminalId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return;
        }

        const status = String(data.status ?? "pending").toLowerCase();
        const restoredId = String(data.id);
        const resolvedAmount = Number(data.amount ?? 0);

        setTransactionId(restoredId);
        setLockedAmount(Number.isFinite(resolvedAmount) ? resolvedAmount.toFixed(2) : "");
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `terminal_id=eq.${terminalId}` },
        (payload) => {
          const rec = payload.new as TransactionRecord | null;
          if (!rec) return;
          if (rec.status === "settled") {
            setPaymentStatus("SETTLED");
            setLatestTxHash((rec as any).tx_hash ?? (rec as any).signature ?? null);
            setIsPaid(true);
            setStep("PAYING");
            setToast("Transaction settled on-chain");
            playPaymentConfirmationTone();
            requestAnimationFrame(() => {
              successRef.current?.focus();
            });
          } else {
            setPaymentStatus(String(rec.status ?? "PENDING").toUpperCase());
            setIsPaid(false);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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

  const qrUri = (() => {
    try {
      return buildUri();
    } catch (error) {
      console.error("Unable to render payment URI", error);
      return "";
    }
  })();

  const merchantInitial = typeof merchantName === "string" && merchantName.trim().length > 0
    ? merchantName.trim().charAt(0).toUpperCase()
    : "O";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-8 space-y-4">
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Opayque</p>
          <div className="flex items-center justify-between gap-4 rounded-[2.2rem] border border-white/10 bg-zinc-900/60 p-4 shadow-[0_0_20px_rgba(168,85,247,0.18)]">
              <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full border border-white/10 bg-gradient-to-br from-violet-700 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,0.35)] overflow-hidden flex items-center justify-center text-2xl font-black text-white">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Merchant Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{merchantInitial}</span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Merchant Identity</p>
                <h1 className="text-2xl font-black tracking-tight text-white">{merchantName}</h1>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {terminalId ? (
                  <button
                    onClick={() => void unpairTerminal()}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-2 rounded-xl border border-white/10 bg-zinc-900/50 hover:bg-red-600/20"
                  >
                    Unpair
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {step === 'PAIRING' && (
          <form onSubmit={handlePairing} className="text-center">
            <input
              ref={pairingRef}
              aria-label="Pairing Code"
              inputMode="text"
              type="text"
              maxLength={12}
              placeholder="Enter pairing code"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 12))}
              className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-4xl font-mono font-black outline-none mb-6"
            />
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Use the generated fleet code to unlock the staff terminal.
            </p>
            <button
              type="submit"
              disabled={isPairing}
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-60"
            >
              {isPairing ? "Pairing..." : "Pair Device"}
            </button>
          </form>
        )}

        {step === "POS" && (
          <div className="text-center">
            <input
              aria-label="Transaction Amount"
              inputMode="decimal"
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full"
            />
            <button
              onClick={handleGenerateQR}
              disabled={!isAmountValid}
              className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl disabled:opacity-20 uppercase tracking-tighter"
            >
              Generate QR
            </button>
          </div>
        )}

        {step === "PAYING" && (
          <div className="text-center">
            <TerminalPaymentErrorBoundary
              onReset={() => {
                setStep("POS");
                setIsPaid(false);
                setLockedAmount("");
                setAmount("");
                setTransactionId(null);
                setPaymentStatus(null);
                setLatestTxHash(null);
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("opayque_pending_tx_id");
                  }
                } catch {}
                setToast("Payment flow reset");
              }}
            >
              {!isPaid ? (
                <div className="flex flex-col items-center">
                  {qrUri ? (
                    <>
                      <div className="p-10 bg-white rounded-[4rem] inline-block mb-4 border-[16px] border-zinc-900 shadow-2xl">
                        <QRCodeSVG value={qrUri} size={220} level="H" />
                      </div>
                      <a
                        href={`https://phantom.app/ul/v1/browse?url=${encodeURIComponent(qrUri)}`}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-purple-600 px-6 py-4 font-black uppercase tracking-[0.25em] text-sm text-white shadow-lg transition hover:bg-purple-500"
                      >
                        Generate New Payment
                      </a>
                    </>
                  ) : (
                    <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-8 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Payment link unavailable</p>
                      <h3 className="mt-3 text-2xl font-black">We could not build a checkout link yet.</h3>
                      <p className="mt-2 text-sm text-zinc-400">Confirm the merchant wallet is available, then try again.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={successRef}
                  tabIndex={-1}
                  aria-live="polite"
                  className="flex flex-col items-center"
                >
                  <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl italic font-black">✓</span>
                  </div>
                  <h2 className="text-5xl font-black italic uppercase">Settled</h2>
                </div>
              )}
            </TerminalPaymentErrorBoundary>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}