"use client";

import { Component, useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent, type ErrorInfo, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LucideEdit3 } from "lucide-react";
import { createSessionChallenge, createTerminalSession, getActiveMerchantId, getActiveSession, setActiveSession } from "@/lib/crypto/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generatePaymentURL } from "@/lib/solana/pay";
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

  const numericAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount < 1_000_000;

  const buildUri = useCallback(() => {
    try {
      const recipient = typeof activeSession?.walletAddress === "string" ? activeSession.walletAddress.trim() : "";
      const amountValue = lockedAmount || (isAmountValid ? numericAmount.toFixed(2) : "0.00");
      return generatePaymentURL({
        recipient,
        amount: amountValue,
        splToken: asset === "SOL" ? null : asset,
        reference: transactionId ?? undefined,
        label: `Opayque POS ${asset}`,
        message: `Secure ${asset} checkout via Opayque`,
      });
    } catch (error) {
      console.error("Failed to build payment URI", error);
      return "";
    }
  }, [activeSession?.walletAddress, asset, isAmountValid, lockedAmount, numericAmount, transactionId]);

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

      setActiveSession(session);
      setStep("POS");
      setToast("Terminal paired successfully");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setIsPairing(false);
    }
  };

  const handleGenerateQR = () => {
    if (!isAmountValid) return;
    setLockedAmount(numericAmount.toFixed(2));
    setStep("PAYING");
  };

  const triggerSuccess = useCallback(async () => {
    if (isPaid || !isAmountValid) return;

    try {
      const merchantId = typeof activeSession?.merchantId === "string" ? activeSession.merchantId.trim() : "";
      if (!merchantId) {
        throw new Error("Active merchant session is required to register a transaction.");
      }

      let supabase;
      try {
        supabase = createSupabaseBrowserClient();
      } catch {
        throw new Error("Supabase client is unavailable in this browser session.");
      }

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          merchant_id: merchantId,
          terminal_id: null,
          signature: null,
          token_symbol: asset,
          amount: numericAmount,
          status: "pending",
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Transaction insertion failed");
      }

      setTransactionId((data as TransactionRecord).id);
      setToast("Pending transaction registered in Supabase");
      setIsPaid(true);
      requestAnimationFrame(() => {
        successRef.current?.focus();
      });
      return;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Transaction registration failed.");
    }
  }, [activeSession?.merchantId, asset, isAmountValid, isPaid, numericAmount]);

  useEffect(() => {
    setMounted(true);

    try {
      if (typeof window !== "undefined") {
        const savedName = window.localStorage.getItem("merchant_name")?.trim();
        const savedAvatar = window.localStorage.getItem("merchant_avatar")?.trim();
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

    if (activeSession) {
      setStep("POS");
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
          if (record?.status) {
            setToast(`Transaction status: ${record.status}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

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
            </div>
          </div>
        </div>

        {step === "PAIRING" && (
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
              onClick={() => setStep("PAYING")}
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
                setToast("Payment flow reset");
              }}
            >
              {!isPaid ? (
                <div className="flex flex-col items-center">
                  {qrUri ? (
                    <>
                      <div
                        ref={successRef}
                        role="button"
                        tabIndex={0}
                        onClick={triggerSuccess}
                        className="p-10 bg-white rounded-[4rem] inline-block mb-4 border-[16px] border-zinc-900 shadow-2xl cursor-pointer"
                      >
                        <QRCodeSVG value={qrUri} size={220} level="H" />
                      </div>
                      <a
                        href={qrUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 font-black uppercase tracking-[0.25em] text-sm text-white shadow-lg transition hover:bg-blue-500"
                      >
                        Pay on this Device
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