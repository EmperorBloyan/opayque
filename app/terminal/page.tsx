"use client";

import { Component, useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent, type FormEvent, type ErrorInfo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Bell, LucideEdit3, X } from "lucide-react";
import { clearTerminalDeviceCredential, createSessionChallenge, createTerminalSession, getActiveMerchantId, getActiveSession, loadTerminalDeviceCredential, saveTerminalDeviceCredential, setActiveSession } from "@/lib/crypto/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { assertTerminalReady, isRealMerchantId, resolveTerminalContext } from "@/lib/terminal/guards";
import { useCurrency } from "@/lib/context/CurrencyContext";
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
  const [lockedUsdcAmount, setLockedUsdcAmount] = useState<string>("");
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Correct currency hooks
  const { currency, setCurrency, rates, toUsdc } = useCurrency();

  const pairingRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const activeSession = getActiveSession();
  const terminalContext = resolveTerminalContext({
    device: loadTerminalDeviceCredential(),
    session: activeSession,
  });
  const router = useRouter();

  const persistLocalActivity = useCallback((items: any[]) => {
    if (typeof window === "undefined") return items;
    const next = items.slice(0, 20);
    window.localStorage.setItem("opayque_terminal_transactions", JSON.stringify(next));
    return next;
  }, []);

  const readLocalActivity = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem("opayque_terminal_transactions");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const hydrateRecentActivity = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const windowNow = Date.now();
      const cutoff = new Date(windowNow - 24 * 60 * 60 * 1000).toISOString();
      const context = resolveTerminalContext({ device: loadTerminalDeviceCredential(), session: getActiveSession() });
      if (context.status !== "ready" || !context.terminalId) {
        setRecentActivity([]);
        return;
      }

      const { data, error } = await supabase
        .from("payment_ledger")
        .select("*")
        .eq("merchant_id", context.merchantId)
        .eq("terminal_id", context.terminalId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error || !Array.isArray(data)) {
        setRecentActivity([]);
        return;
      }

      const mapped = data.map((row: any) => ({
        id: String(row.id ?? row.signature ?? "pending"),
        status: String(row.status ?? "pending").toUpperCase(),
        amount: Number(row.amount ?? 0),
        tokenSymbol: String(row.token_symbol ?? "USDC"),
        time: row.created_at ?? new Date().toISOString(),
        walletAddress: row.wallet_address ?? context.merchantWallet,
        txHash: row.tx_hash ?? row.signature ?? null,
      }));

      const merged = [...mapped, ...readLocalActivity().filter((tx: any) => !mapped.some((item) => item.id === tx.id))].slice(0, 20);
      setRecentActivity(merged);
      persistLocalActivity(merged);
    } catch (error) {
      console.warn("Failed to hydrate recent terminal activity", error);
      setRecentActivity([]);
    }
  }, [persistLocalActivity, readLocalActivity]);

  useEffect(() => {
    if (!activeSession && !loadTerminalDeviceCredential()) {
      setToast("Ready to pair a terminal. Enter the fleet code to continue.");
    }
  }, [activeSession]);

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

  // Fixed buildUri — uses toUsdc for settlement
  const buildUri = useCallback(() => {
    try {
      const context = resolveTerminalContext({
        device: loadTerminalDeviceCredential(),
        session: getActiveSession(),
      });
      const recipient = context.status === "ready" ? context.merchantWallet : "";

      const amountValue = lockedAmount || amount || "";
      const fiatAmount = Number.parseFloat(String(amountValue).trim());

      if (!recipient || !Number.isFinite(fiatAmount) || fiatAmount <= 0) {
        return "";
      }

      // A resumed transaction is already denominated in USDC. New payments use
      // the current display-currency rate exactly once.
      const usdcAmount = lockedUsdcAmount
        ? Number(lockedUsdcAmount)
        : toUsdc(fiatAmount, currency);
      if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
        return "";
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://opayque.vercel.app";

      const checkoutUrl = new URL("/checkout", origin);
      checkoutUrl.searchParams.set("address", recipient);
      checkoutUrl.searchParams.set("amount", usdcAmount.toFixed(6)); // USDC settlement amount
      checkoutUrl.searchParams.set("fiat_amount", fiatAmount.toFixed(2));
      checkoutUrl.searchParams.set("currency", currency || "USD");
      checkoutUrl.searchParams.set("token", asset || "USDC");
      checkoutUrl.searchParams.set("name", merchantName || "Opayque Merchant");
      if (transactionId) checkoutUrl.searchParams.set("tx_id", transactionId);

      return checkoutUrl.toString();
    } catch (error) {
      console.error("Failed to build checkout URL", error);
      return "";
    }
  }, [
    amount,
    lockedAmount,
    lockedUsdcAmount,
    merchantName,
    currency,
    asset,
    toUsdc,
    transactionId,
  ]);

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
        throw new Error("This pairing code is not linked to a vault merchant wallet. Use a code generated in the vault registry.");
      }

      const challenge = createSessionChallenge();
      const session = await createTerminalSession({
        merchantId: resolvedMerchantId,
        walletAddress: pairedWalletAddress,
        nonce: challenge.nonce,
        walletSignature: new TextEncoder().encode(`terminal-pair:${resolvedMerchantId}`),
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem("opayque_terminal_merchant_id", resolvedMerchantId);
        window.localStorage.setItem("opayque_terminal_wallet", pairedWalletAddress);
      }

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

      const pairedTerminalId = typeof payload?.terminalId === "string" ? payload.terminalId : null;
      const pairedDeviceToken = typeof payload?.deviceToken === "string" ? payload.deviceToken : null;
      if (pairedTerminalId && pairedDeviceToken) {
        window.localStorage.setItem("opayque_terminal_id", pairedTerminalId);
        window.localStorage.setItem("opayque_terminal_token", pairedDeviceToken);
        window.localStorage.setItem("opayque_terminal_label", resolvedTerminalLabel);
        saveTerminalDeviceCredential({
          terminalId: pairedTerminalId,
          merchantId: resolvedMerchantId,
          deviceToken: pairedDeviceToken,
          merchantWallet: pairedWalletAddress,
          pairedAt: Date.now(),
        });
        setTerminalId(pairedTerminalId);
        setTerminalToken(pairedDeviceToken);
      }

      setActiveSession(session);

      setStep("POS");
      setToast("Terminal paired successfully");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Pairing failed");
    } finally {
      setIsPairing(false);
    }
  };

  const generateNewPayment = async () => {
    if (!isAmountValid || isGenerating) return;
    if (asset !== "USDC") {
      setToast("This hosted checkout currently supports USDC payments only");
      return;
    }

    const settlementAmount = toUsdc(numericAmount, currency);
    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0 || settlementAmount >= 1_000_000) {
      setToast(`FX rate unavailable for ${currency}. Refresh rates and try again.`);
      return;
    }
    const normalizedSettlementAmount = Number(settlementAmount.toFixed(6));

    let timeout: ReturnType<typeof setTimeout> | undefined;
    setIsGenerating(true);
    try {
      assertTerminalReady(terminalContext);
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch("/api/terminal/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminalId: terminalContext.terminalId,
          deviceToken: terminalContext.deviceToken,
          amount: normalizedSettlementAmount,
          tokenSymbol: "USDC",
        }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.id) {
        throw new Error(data?.error || "Unable to create payment");
      }

      const pendingRecord = data as TransactionRecord & { tx_hash?: string | null; wallet_address?: string | null; token_symbol?: string | null; created_at?: string };
      const nextActivity = [{
        id: String(pendingRecord.id),
        status: "PENDING",
        amount: Number(pendingRecord.amount ?? normalizedSettlementAmount),
        tokenSymbol: String(pendingRecord.token_symbol ?? "USDC"),
        fiatAmount: numericAmount,
        displayCurrency: currency,
        time: pendingRecord.created_at ?? new Date().toISOString(),
        walletAddress: terminalContext.merchantWallet,
        txHash: pendingRecord.tx_hash ?? null,
      }, ...readLocalActivity()];
      setRecentActivity(persistLocalActivity(nextActivity));
      setTransactionId(String(pendingRecord.id));
      setLatestTxHash(null);
      setIsPaid(false);

      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("opayque_pending_tx_id", String((data as TransactionRecord).id));
        }
      } catch {}
      setLockedAmount(numericAmount.toFixed(2));
      setLockedUsdcAmount(normalizedSettlementAmount.toFixed(6));
      setStep("PAYING");
      setPaymentStatus("PENDING");
      setToast("Pending transaction created");
    } catch (err) {
      setToast(err instanceof DOMException && err.name === "AbortError" ? "Payment request timed out. Try again." : err instanceof Error ? err.message : "Unable to create payment");
    } finally {
      if (timeout) clearTimeout(timeout);
      setIsGenerating(false);
    }
  };

  const handleGenerateQR = async () => {
    await generateNewPayment();
  };

  const handleActivityClick = (transaction: any) => {
    if (String(transaction.status ?? "").toLowerCase() !== "pending") return;

    const transactionAmount = Number(transaction.amount);
    if (!transaction.id || !Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      setToast("Pending payment details are unavailable");
      return;
    }

    setTransactionId(String(transaction.id));
    setLockedAmount(Number(transaction.fiatAmount ?? transactionAmount).toFixed(2));
    setLockedUsdcAmount(transactionAmount.toFixed(6));
    setAmount(transactionAmount.toFixed(2));
    setPaymentStatus("PENDING");
    setLatestTxHash(null);
    setIsPaid(false);
    setIsActivityOpen(false);
    setStep("PAYING");
  };

  const triggerSuccess = useCallback(async () => {
    return;
  }, [isPaid, isAmountValid]);

  useEffect(() => {
    setMounted(true);
    setRecentActivity(readLocalActivity());

    try {
      if (typeof window !== "undefined") {
        const savedName = window.localStorage.getItem("merchant_name")?.trim();
        const savedAvatar = window.localStorage.getItem("merchant_logo")?.trim() || window.localStorage.getItem("merchant_avatar")?.trim();
        const savedCurrency = window.localStorage.getItem("merchant_preferred_currency")?.trim();
        if (savedName) {
          setMerchantName(savedName);
        }
        if (savedAvatar) {
          setAvatarPreview(savedAvatar);
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
      }
    } catch (error) {
      console.warn("Unable to read merchant preferences from storage", error);
    }

    try {
      if (typeof window !== "undefined") {
        const storedId = window.localStorage.getItem("opayque_terminal_id")?.trim() || null;
        const storedToken = window.localStorage.getItem("opayque_terminal_token")?.trim() || null;
        if (storedId) {
          const storedCredential = loadTerminalDeviceCredential();
          if (storedCredential?.terminalId === storedId && storedCredential.deviceToken === storedToken) {
            setTerminalId(storedCredential.terminalId);
            setTerminalToken(storedCredential.deviceToken);
            setMerchantName("Opayque Merchant");
            setStep("POS");
          }
          const supabase = createSupabaseBrowserClient();
          (async () => {
            try {
              if (!storedToken) return;
              const response = await fetch(`/api/terminal/bootstrap?terminalId=${encodeURIComponent(storedId)}&deviceToken=${encodeURIComponent(storedToken)}`);
              const payload = await response.json().catch(() => null);
              if (
                response.ok &&
                payload?.success &&
                typeof payload.merchantId === "string" &&
                isRealMerchantId(payload.merchantId) &&
                typeof payload.merchantWallet === "string" &&
                payload.merchantWallet.trim()
              ) {
                saveTerminalDeviceCredential({
                  terminalId: String(payload.terminalId),
                  merchantId: String(payload.merchantId),
                  deviceToken: storedToken,
                  merchantWallet: String(payload.merchantWallet),
                  pairedAt: loadTerminalDeviceCredential()?.pairedAt ?? Date.now(),
                });
                setTerminalId(storedId);
                setTerminalToken(storedToken);
                setMerchantName(String(payload.merchantName || "Opayque Merchant"));
                setAvatarPreview(payload.merchantLogo || null);
                setStep("POS");
              } else if (response.status === 401) {
                window.localStorage.removeItem("opayque_terminal_id");
                window.localStorage.removeItem("opayque_terminal_token");
                clearTerminalDeviceCredential();
                setTerminalId(null);
                setTerminalToken(null);
                setStep("PAIRING");
                setToast(payload?.error || "Terminal pairing expired. Pair this device again.");
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
    if (terminalId) void hydrateRecentActivity();
  }, [hydrateRecentActivity, terminalId]);

  useEffect(() => {
    if (!transactionId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const context = resolveTerminalContext({ device: loadTerminalDeviceCredential(), session: getActiveSession() });
      if (context.status !== "ready") return;
      const merchantId = context.merchantId;
      channel = supabase
        .channel(`transactions:${merchantId}:${transactionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "payment_ledger", filter: `merchant_id=eq.${merchantId}` },
          (payload) => {
            const record = payload.new as TransactionRecord | null;
            if (!record || String(record.id) !== transactionId) return;
            const nextActivityItem = {
              id: String(record.id ?? transactionId),
              status: String(record.status ?? "pending").toUpperCase(),
              amount: Number(record.amount ?? 0),
              tokenSymbol: String((record as any).token_symbol ?? asset),
              time: (record as any).created_at ?? new Date().toISOString(),
              walletAddress: context.merchantWallet,
              txHash: (record as any).tx_hash ?? (record as any).signature ?? null,
            };
            const merged = [nextActivityItem, ...readLocalActivity().filter((tx: any) => tx.id !== nextActivityItem.id)].slice(0, 20);
            setRecentActivity(persistLocalActivity(merged));
            if (record.status === "settled") {
              setPaymentStatus("SETTLED");
              setLatestTxHash((record as any).tx_hash ?? (record as any).signature ?? null);
              setIsPaid(true);
              setToast("Transaction settled on-chain");
              requestAnimationFrame(() => {
                successRef.current?.focus();
              });
            } else if (record.status) {
              setToast(`Transaction status: ${record.status}`);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [activeSession?.walletAddress, asset, persistLocalActivity, readLocalActivity, transactionId]);

  const unpairTerminal = async () => {
    let remoteError: string | null = null;
    try {
      const device = loadTerminalDeviceCredential();
      if (device?.terminalId && device.deviceToken) {
        const response = await fetch("/api/terminal/unpair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terminalId: device.terminalId, deviceToken: device.deviceToken }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          remoteError = payload?.error || "Unable to revoke terminal remotely";
        }
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : "Unable to revoke terminal remotely";
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("opayque_terminal_id");
        window.localStorage.removeItem("opayque_terminal_token");
        window.localStorage.removeItem("opayque_terminal_label");
        clearTerminalDeviceCredential();
      }
      setTerminalId(null);
      setTerminalToken(null);
      setStep("PAIRING");
      setToast(remoteError ? `Terminal removed locally. ${remoteError}` : "Terminal unpaired");
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

  const renderActivityList = recentActivity.filter((tx: any) => {
    const when = tx.time ? new Date(tx.time).getTime() : 0;
    return Date.now() - when <= 24 * 60 * 60 * 1000;
  }).slice(0, 10);

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
                <button
                  type="button"
                  aria-label="Recent activity"
                  onClick={() => setIsActivityOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-300 transition hover:bg-zinc-800"
                >
                  <Bell size={16} />
                </button>
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
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-left">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white outline-none"
              >
                {Object.keys(rates || {}).length > 0 ? (
                  Object.keys(rates).map((curr) => <option key={curr} value={curr}>{curr}</option>)
                ) : (
                  <option value="USD">USD</option>
                )}
              </select>
            </div>
            <div className="mb-4 flex items-center justify-center gap-2 text-zinc-400">
              <span className="text-sm uppercase tracking-[0.3em]">Amount</span>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300">{currency}</span>
            </div>
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
              disabled={!isAmountValid || terminalContext.status !== "ready" || isGenerating}
              className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl disabled:opacity-20 uppercase tracking-tighter"
            >
              {isGenerating ? "Creating..." : "Generate QR"}
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
                setLockedUsdcAmount("");
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
                  <div className="mt-4 space-y-2 text-center text-xs font-mono uppercase tracking-[0.2em] text-zinc-300">
                    {activeSession?.walletAddress && (
                      <p>From {`${activeSession.walletAddress.slice(0, 3)}...${activeSession.walletAddress.slice(-3)}`}</p>
                    )}
                    {transactionId && (
                      <p>Tx {`${transactionId.slice(0, 3)}...${transactionId.slice(-3)}`}</p>
                    )}
                  </div>
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
        {step === 'PAYING' && isPaid && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={() => {
                setIsPaid(false);
                setPaymentStatus(null);
                setLatestTxHash(null);
                setTransactionId(null);
                setLockedAmount("");
                setLockedUsdcAmount("");
                setAmount("");
                setStep("POS");
                setToast("Ready for a new payment");
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("opayque_pending_tx_id");
                }
              }}
              className="rounded-full bg-green-600 px-6 py-3 font-black uppercase tracking-wider shadow-xl text-white"
            >
              Generate New Payment
            </button>
          </div>
        )}

        {isActivityOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Recent Activity</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Transactions received</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActivityOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-400"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase">Tx ID</th>
                      <th className="px-4 py-3 font-bold uppercase">Status</th>
                      <th className="px-4 py-3 font-bold uppercase">Amount</th>
                      <th className="px-4 py-3 font-bold uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-black/30">
                    {renderActivityList.length > 0 ? renderActivityList.map((tx: any, idx: number) => (
                      <tr
                        key={`${tx.id ?? idx}`}
                        onClick={() => handleActivityClick(tx)}
                        className={`hover:bg-white/5 ${String(tx.status ?? "").toLowerCase() === "pending" ? "cursor-pointer" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-zinc-300">{tx.id ? `${tx.id.slice(0, 6)}...${tx.id.slice(-4)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                            {tx.status || "PENDING"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-violet-300">
                          {Number(tx.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {String(tx.tokenSymbol ?? "USDC").toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{tx.time ? new Date(tx.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No transactions received in the last 24 hours.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}