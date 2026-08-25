"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey, SendTransactionError, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LucideCheckCircle2, LucideLoader2, LucideShieldCheck } from "lucide-react";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { appendLocalActivity } from "@/lib/activity";
import { getAssetMintAddress, isDevnetNetwork } from "@/lib/solana/constants";
import { sendPayment } from "@/lib/solana/sendPayment";

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
}: ShieldedCheckoutProps) {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [successSignature, setSuccessSignature] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

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

    let paymentConnection: Connection | null = null;
    try {
      const rpc = process.env.NEXT_PUBLIC_RPC_URL ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.devnet.solana.com";
      const connection = new Connection(rpc, "confirmed");
      const isDevnet = isDevnetNetwork();
      const mint = new PublicKey(getAssetMintAddress("USDC", isDevnet));
      const [solLamports, tokenAccounts] = await withTimeout(Promise.all([
        connection.getBalance(publicKey, "confirmed"),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint }),
      ]), 10000, "Wallet balance check");
      const usdcBaseUnits = tokenAccounts.value.reduce(
        (total, account) => total + BigInt(account.account.data.parsed?.info?.tokenAmount?.amount ?? "0"),
        0n
      );
      const requiredUsdcBaseUnits = BigInt(Math.ceil(safeAmount * 1_000_000));
      if (solLamports < 5_000) {
        throw new Error(`Insufficient SOL for network fees. Add ${isDevnet ? "Devnet" : "Mainnet"} SOL to this wallet.`);
      }
      if (usdcBaseUnits < requiredUsdcBaseUnits) {
        throw new Error(`Insufficient USDC on ${isDevnet ? "Devnet" : "Mainnet"}. Add funds to this wallet before paying.`);
      }

      const built = await withTimeout(
        buildShieldedTransfer(
          publicKey.toBase58(),
          safeMerchantPubkey,
          safeAmount,
          transactionId || checkoutSessionId || ""
        ),
        25000,
        "Shielded transfer build"
      );

      let signature: string | null = null;

      paymentConnection = new Connection(built.rpcUrl || rpc, "confirmed");

      // buildShieldedTransfer returns VersionedTransaction
      if (built.mode !== "private") {
        throw new Error("Private payment transaction was not returned by MagicBlock.");
      }

      if (built.transaction instanceof VersionedTransaction || built.transaction instanceof Transaction) {
        if (signTransaction && built.transaction instanceof VersionedTransaction) {
          setMessage("Approve in your wallet...");
          signature = await sendPayment(paymentConnection, built.transaction, signTransaction);
          setMessage("Payment confirmed on Solana.");
        } else if (signTransaction) {
          const freshBlockhash = await paymentConnection.getLatestBlockhash("confirmed");
          if (built.transaction instanceof VersionedTransaction) {
            built.transaction.message.recentBlockhash = freshBlockhash.blockhash;
          } else {
            built.transaction.recentBlockhash = freshBlockhash.blockhash;
            built.transaction.lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;
            built.transaction.feePayer = publicKey;
          }
          setMessage("Approve in your wallet...");
          const signed = await signTransaction(built.transaction as any);
          setMessage("Submitting transaction...");
          signature = await paymentConnection.sendRawTransaction(
            signed.serialize(),
            { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 0 }
          );
          setMessage("Confirming on Solana...");
          await paymentConnection.confirmTransaction({
            signature,
            ...freshBlockhash,
          }, "confirmed");
        } else if (sendTransaction) {
          const freshBlockhash = await paymentConnection.getLatestBlockhash("confirmed");
          if (built.transaction instanceof VersionedTransaction) {
            built.transaction.message.recentBlockhash = freshBlockhash.blockhash;
          } else {
            built.transaction.recentBlockhash = freshBlockhash.blockhash;
            built.transaction.lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;
            built.transaction.feePayer = publicKey;
          }
          setMessage("Approve in your wallet...");
          signature = await sendTransaction(built.transaction as any, paymentConnection, {
              skipPreflight: false,
              preflightCommitment: "confirmed",
              maxRetries: 0,
            });
          setMessage("Confirming on Solana...");
          await paymentConnection.confirmTransaction({
            signature,
            ...freshBlockhash,
          }, "confirmed");
        } else {
          throw new Error("Wallet cannot sign or send transactions.");
        }
      } else {
        throw new Error("Invalid transaction payload from transfer API.");
      }

      if (!signature) {
        throw new Error("Transaction was not signed or submitted.");
      }

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
      setStatus("error");
      setMessage(
        /blockhash|expired|timed out|confirmation/i.test(errorMessage)
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
            Shielded Checkout
          </h3>
          {recipientName ? (
            <p className="text-zinc-500 text-sm mt-1">Paying {recipientName}</p>
          ) : (
            <p className="text-zinc-500 text-sm mt-1">Private mode via MagicBlock when available</p>
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
        </div>

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
              Shielded transfer of{" "}
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
                  "Pay Privately"
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