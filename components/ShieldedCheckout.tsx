"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey, SendTransactionError, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Copy, LucideCheckCircle2, LucideLoader2, LucideShieldCheck, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { appendLocalActivity } from "@/lib/activity";
import { getAssetMintAddress, getSolanaRpcUrls, isDevnetNetwork } from "@/lib/solana/constants";
import { sendLegacyPayment, sendPayment, sendStandardPayment } from "@/lib/solana/sendPayment";
import { clearPendingPayment, readPendingPayment, writePendingPayment } from "@/lib/solana/paymentRecovery";
import type { TransferMode } from "@/lib/payments/transferMode";

type PaymentStatus = "idle" | "processing" | "success" | "error";

interface ShieldedCheckoutProps {
  amount: number;
  merchantPubkey: string;
  endpointName?: string;
  endpointCategory?: string;
  allowCustomAmount?: boolean;
  recipientName?: string;
  displayCurrency?: string;
  displayFiatAmount?: number;
  settlementToken?: string;
  transactionId?: string | null;
  checkoutSessionId?: string | null;
  transferMode?: TransferMode;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function loadWalletBalances(
  rpcUrls: string[],
  publicKey: PublicKey,
  mint: PublicKey,
): Promise<{ connection: Connection; rpcUrl: string; solLamports: number; tokenAccounts: Awaited<ReturnType<Connection["getParsedTokenAccountsByOwner"]>> }> {
  let lastError: unknown;

  for (const rpcUrl of [...new Set(rpcUrls)]) {
    const connection = new Connection(rpcUrl, "confirmed");
    try {
      const [solLamports, tokenAccounts] = await withTimeout(Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint }),
      ]), 10_000, "Wallet balance check");
      return { connection, rpcUrl, solLamports, tokenAccounts };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Wallet balance check failed");
}

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
  endpointName,
  endpointCategory,
  allowCustomAmount = false,
  recipientName,
  displayCurrency = "USD",
  displayFiatAmount,
  settlementToken = "USDC",
  transactionId,
  checkoutSessionId,
  transferMode: initialTransferMode = "private",
}: ShieldedCheckoutProps) {
  const { publicKey, connected, signTransaction } = useWallet();

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [successSignature, setSuccessSignature] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [transferMode, setTransferMode] = useState<TransferMode>(initialTransferMode);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffCopied, setHandoffCopied] = useState(false);

  const [draftAmount, setDraftAmount] = useState(() =>
    Number.isFinite(amount) && amount > 0 ? amount : 10
  );

  useEffect(() => {
    if (!allowCustomAmount) {
      setDraftAmount(Number.isFinite(amount) && amount > 0 ? amount : 10);
    }
  }, [allowCustomAmount, amount]);

  const safeMerchantPubkey = useMemo(
    () => merchantPubkey?.trim() || "",
    [merchantPubkey]
  );

  const effectiveAmount = allowCustomAmount ? Number(draftAmount) : Number(amount);
  const safeAmount =
    Number.isFinite(effectiveAmount) && effectiveAmount > 0 ? effectiveAmount : 0;

  const fiatLabelAmount =
    Number.isFinite(Number(displayFiatAmount)) && Number(displayFiatAmount) > 0
      ? Number(displayFiatAmount)
      : safeAmount;

  const isLocked = status === "success" || status === "processing";
  const handoffUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!showHandoffModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHandoffModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHandoffModal]);

  // Success countdown → close back toward wallet/native context
  useEffect(() => {
    if (status !== "success" || countdown === null) return;

    if (countdown <= 0) {
      try {
        window.close();
      } catch {
        // ignore
      }
      try {
        window.location.href = "about:blank";
      } catch {
        // ignore
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [status, countdown]);

  useEffect(() => {
    const pending = readPendingPayment();
    const currentIntent = transactionId || checkoutSessionId || "";
    if (pending && pending.intentId === currentIntent) {
      clearPendingPayment(currentIntent);
      setStatus("error");
      setMessage("A previous payment was interrupted before completion. Please try again.");
    }
  }, [checkoutSessionId, transactionId]);

  useEffect(() => {
    setTransferMode(initialTransferMode);
  }, [initialTransferMode]);

  useEffect(() => {
    if (!checkoutSessionId) return;
    let cancelled = false;
    fetch(`/api/v1/checkout/${encodeURIComponent(checkoutSessionId)}/status`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setTransferMode(payload?.transferMode === "public" ? "public" : "private");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId]);

  const handlePayment = async () => {
    if (isLocked) return;

    if (!connected || !publicKey) {
      setStatus("error");
      setMessage("Connect your wallet to continue.");
      return;
    }

    if (!safeMerchantPubkey) {
      setStatus("error");
      setMessage("Merchant destination wallet is missing.");
      return;
    }

    if (safeAmount <= 0) {
      setStatus("error");
      setMessage("Enter a valid amount greater than 0.");
      return;
    }

    setStatus("processing");
    setMessage("Building transaction...");
    setSuccessSignature(null);
    const intentId = transactionId || checkoutSessionId || "";
    writePendingPayment({
      intentId,
      sender: publicKey.toBase58(),
      recipient: safeMerchantPubkey,
      amount: safeAmount,
      phase: "building",
      startedAt: Date.now(),
    });

    let paymentConnection: Connection | null = null;
    try {
      const isDevnet = isDevnetNetwork();
      const mint = new PublicKey(getAssetMintAddress("USDC", isDevnet));
      const rpcUrls = getSolanaRpcUrls();
      const buildPromise = transferMode === "private"
        ? withTimeout(
            buildShieldedTransfer(
              publicKey.toBase58(),
              safeMerchantPubkey,
              safeAmount,
              transactionId || checkoutSessionId || ""
            ),
            25000,
            "Shielded transfer build"
          )
        : withTimeout(
            fetch("/api/transfer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sender: publicKey.toBase58(),
                recipient: safeMerchantPubkey,
                amount: safeAmount,
                mint: mint.toBase58(),
                intent_id: intentId,
                mode: "public",
              }),
            }).then(async (response) => {
              const payload = await response.json().catch(() => ({}));
              if (!response.ok || payload?.mode !== "public" || typeof payload.transaction !== "string") {
                throw new Error(payload?.error || "Public payment transaction could not be built");
              }
              const bytes = Uint8Array.from(atob(payload.transaction), (character) => character.charCodeAt(0));
              let transaction: VersionedTransaction | Transaction;
              try {
                transaction = VersionedTransaction.deserialize(bytes);
              } catch {
                transaction = Transaction.from(bytes);
              }
              return { ...payload, transaction, mode: "public" as const };
            }),
            25000,
            "Public transfer build"
          );
      const [balanceResult, built] = await Promise.all([
        loadWalletBalances(rpcUrls, publicKey, mint),
        buildPromise,
      ]);
      const { connection, rpcUrl: selectedRpc, solLamports, tokenAccounts } = balanceResult;
      const usdcBaseUnits = tokenAccounts.value.reduce(
        (total, account) => total + BigInt(account.account.data.parsed?.info?.tokenAmount?.amount ?? "0"),
        0n
      );
      const requiredUsdcBaseUnits = BigInt(Math.ceil(safeAmount * 1_000_000));
      const recipientTokenAccount = getAssociatedTokenAddressSync(mint, new PublicKey(safeMerchantPubkey));
      const recipientTokenAccountInfo = await withTimeout(
        connection.getAccountInfo(recipientTokenAccount, "confirmed"),
        10_000,
        "Recipient account check"
      );
      const minimumSolLamports = recipientTokenAccountInfo ? 5_000 : 2_100_000;
      if (solLamports < minimumSolLamports) {
        throw new Error(`Insufficient SOL for network fees${recipientTokenAccountInfo ? "" : " and token-account rent"}. Add ${isDevnet ? "Devnet" : "Mainnet"} SOL to this wallet.`);
      }
      if (usdcBaseUnits < requiredUsdcBaseUnits) {
        throw new Error(`Insufficient USDC on ${isDevnet ? "Devnet" : "Mainnet"}. Add funds to this wallet before paying.`);
      }

      let signature: string | null = null;

      paymentConnection = new Connection(built.rpcUrl || selectedRpc, "confirmed");

      if (built.mode !== transferMode) {
        throw new Error(`${transferMode === "private" ? "Private" : "Public"} payment transaction was not returned.`);
      }

      if (built.transaction instanceof VersionedTransaction && signTransaction) {
        setMessage("Approve in your wallet...");
        writePendingPayment({ intentId, sender: publicKey.toBase58(), recipient: safeMerchantPubkey, amount: safeAmount, phase: "awaiting_wallet", startedAt: Date.now() });
        signature = transferMode === "public"
          ? await sendStandardPayment(paymentConnection, built.transaction, signTransaction)
          : await sendPayment(paymentConnection, built.transaction, signTransaction);
        setMessage("Payment confirmed on Solana.");
      } else if (built.transaction instanceof Transaction && signTransaction) {
        setMessage("Approve in your wallet...");
        writePendingPayment({ intentId, sender: publicKey.toBase58(), recipient: safeMerchantPubkey, amount: safeAmount, phase: "awaiting_wallet", startedAt: Date.now() });
        setMessage("Submitting transaction...");
        signature = await sendLegacyPayment(paymentConnection, built.transaction, signTransaction as any, 90_000);
        setMessage("Confirming on Solana...");
      } else {
        throw new Error("Wallet cannot sign the payment transaction.");
      }

      if (!signature) {
        throw new Error("Transaction was not signed or submitted.");
      }
      writePendingPayment({ intentId, sender: publicKey.toBase58(), recipient: safeMerchantPubkey, amount: safeAmount, phase: "submitted", signature, startedAt: Date.now() });

      if (transactionId) {
        const settleResponse = await fetch(`/api/terminal/payments/${encodeURIComponent(transactionId)}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature }),
        });
        const settlePayload = await settleResponse.json().catch(() => ({}));
        if (!settleResponse.ok) {
          throw new Error(settlePayload?.error || "Payment confirmed, but terminal reconciliation failed.");
        }
      } else if (checkoutSessionId) {
        const verifyResponse = await fetch("/api/v1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutSessionId, transactionSignature: signature }),
        });
        const verifyPayload = await verifyResponse.json().catch(() => ({}));
        if (!verifyResponse.ok) {
          throw new Error(verifyPayload?.error || "Payment confirmed, but checkout verification failed.");
        }
      }

      appendLocalActivity({
        id: signature,
        staff: recipientName || endpointName || "Registry Endpoint",
        category: endpointCategory || "Registry",
        amount: safeAmount,
        status: "SHIELDED",
        time: new Date().toISOString(),
        source: "registry_endpoint",
      });

      setSuccessSignature(signature);
      clearPendingPayment(intentId);
      setStatus("success");
      setMessage("Payment confirmed. Returning to wallet...");
      setCountdown(5);
    } catch (error: any) {
      let errorMessage = error?.message || "Payment failed. Please try again.";
      let transactionLogs: string[] | null = null;
      if (error instanceof SendTransactionError) {
        transactionLogs = paymentConnection ? await error.getLogs(paymentConnection).catch(() => null) : null;
        if (transactionLogs?.length) {
          errorMessage = `${errorMessage} ${transactionLogs.join(" ")}`;
        }
      }
      console.error("Shielded payment failed:", error, { logs: transactionLogs });
      clearPendingPayment(intentId);
      setStatus("error");
      const isWalletApprovalTimeout = /wallet approval timed out/i.test(errorMessage);
      const isRpcTimeout = /blockhash request|transaction simulation|transaction submission|transaction confirmation timed out/i.test(errorMessage);
      const isFeeEstimationError = /estimate(?:d|s)?\s+(?:the\s+)?fee|fee\s+estimation|insufficient.*(?:lamports|sol)/i.test(errorMessage);
      setMessage(
        isWalletApprovalTimeout
          ? "Wallet approval took too long. Please approve the transaction and try again."
          : isFeeEstimationError
          ? `Your wallet could not estimate network fees. Add ${isDevnetNetwork() ? "Devnet" : "Mainnet"} SOL to the paying wallet and try again.`
          : isRpcTimeout || /blockhash|expired|last valid/i.test(errorMessage)
          ? "Transaction expired or took too long. Please try again."
          : errorMessage
      );
    }
  };

  return (
    <div className="relative w-full max-w-md p-8 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col gap-6 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
            <LucideShieldCheck size={22} />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {transferMode === "private" ? "Private Checkout" : "Standard Checkout"}
          </h3>
          {recipientName ? (
            <p className="text-zinc-500 text-sm mt-1">Paying {recipientName}</p>
          ) : (
            <p className="text-zinc-500 text-sm mt-1">Ready to pay securely on Solana</p>
          )}
          {(endpointName || endpointCategory) && (
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mt-2">
              {[endpointName, endpointCategory].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-100 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
            Amount Due
          </p>

          <p className="mt-2 text-4xl font-black text-zinc-900 dark:text-white">
            {fiatLabelAmount.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-base text-zinc-500">{displayCurrency}</span>
          </p>

          <p className="mt-2 text-sm font-mono text-purple-500">
            ≈ {safeAmount.toFixed(2)} {settlementToken || "USDC"}
          </p>

          {allowCustomAmount && status !== "success" && (
            <div className="mt-4 text-left">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                Custom amount ({settlementToken || "USDC"})
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={String(draftAmount)}
                disabled={isLocked}
                onChange={(e) => setDraftAmount(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowHandoffModal(true)}
              className="text-sm font-semibold text-purple-600 transition hover:text-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 dark:text-purple-400 dark:hover:text-purple-300"
            >
              Open on another device
            </button>
          </div>
        </div>

        {showHandoffModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="presentation"
            onClick={() => setShowHandoffModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="handoff-modal-title"
              className="w-full max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <h4 id="handoff-modal-title" className="text-lg font-black text-white">
                  Continue on another device
                </h4>
                <button
                  type="button"
                  aria-label="Close continue on another device modal"
                  onClick={() => setShowHandoffModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="mt-4 text-sm text-zinc-300">
                Scan to open this same payment where your wallet is.
              </p>

              <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
                <QRCodeCanvas value={handoffUrl || ""} size={220} fgColor="#7c3aed" />
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!handoffUrl) return;
                  try {
                    await navigator.clipboard.writeText(handoffUrl);
                    setHandoffCopied(true);
                    window.setTimeout(() => setHandoffCopied(false), 1500);
                  } catch {
                    setHandoffCopied(false);
                  }
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-purple-200 transition hover:bg-purple-500/20"
              >
                {handoffCopied ? (
                  <>
                    <Copy size={14} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy link
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {status === "success" ? (
          <div
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"
            onClick={(e) => e.preventDefault()}
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
              <LucideCheckCircle2 className="text-emerald-400" size={28} />
            </div>
            <p className="text-emerald-300 text-xl font-black uppercase">
              Payment Successful
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {transferMode === "private" ? "Private transfer of" : "Payment of"}{" "}
              <span className="text-white font-semibold">
                {safeAmount.toFixed(2)} {settlementToken || "USDC"}
              </span>{" "}
              finalized.
            </p>
            {successSignature && (
              <p className="mt-3 text-[10px] font-mono text-zinc-500 break-all">
                Ref: {successSignature}
              </p>
            )}
            <p className="mt-5 text-xs uppercase tracking-[0.25em] text-zinc-500">
              Returning in {countdown ?? 5}s
            </p>
          </div>
        ) : (
          <>
            {!connected ? (
              <div className="flex justify-center">
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-xl !h-12 !text-[10px] !font-black !uppercase" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePayment}
                disabled={isLocked || safeAmount <= 0}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {status === "processing" ? (
                  <>
                    <LucideLoader2 className="animate-spin" size={16} />
                    Confirming...
                  </>
                ) : status === "error" ? (
                  "Try Again"
                ) : (
                  transferMode === "private" ? "Pay Privately" : "Pay"
                )}
              </button>
            )}

            {message && (
              <p
                className={`text-sm ${
                  status === "error" ? "text-red-400" : "text-zinc-400"
                }`}
              >
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}