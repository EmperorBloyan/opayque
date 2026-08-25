"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Check, Copy, ShieldCheck, X } from "lucide-react";
import WalletConnectPanel from "@/components/wallet/WalletConnectPanel";

interface SettlementWalletSectionProps {
  currentWallet: string;
  onWalletUpdated: (walletAddress: string) => void;
}

function truncateAddress(address: string) {
  if (address.length <= 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function encodeSignature(signature: Uint8Array) {
  return btoa(
    Array.from(signature)
      .map((byte) => String.fromCharCode(byte))
      .join("")
  );
}

export default function SettlementWalletSection({
  currentWallet,
  onWalletUpdated,
}: SettlementWalletSectionProps) {
  const { publicKey, signMessage } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!currentWallet || !navigator.clipboard) return;
    await navigator.clipboard.writeText(currentWallet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    setError(null);
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    if (!isSubmitting) setIsModalOpen(false);
  };

  const handleConfirm = async () => {
    if (!publicKey || !signMessage) {
      setError("Connect the new wallet before confirming the update.");
      return;
    }

    const newWalletAddress = publicKey.toBase58();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      // TODO: Add password re-authentication when a lightweight auth flow is available.
      const challengeResponse = await fetch("/api/v1/merchant/wallet-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newWalletAddress }),
      });
      const challenge = await challengeResponse.json().catch(() => ({}));

      if (!challengeResponse.ok || typeof challenge.message !== "string") {
        throw new Error(challenge.error || "Unable to create wallet challenge.");
      }

      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const updateResponse = await fetch("/api/v1/merchant/update-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newWalletAddress,
          message: challenge.message,
          signature: encodeSignature(signature),
          nonce: challenge.nonce,
        }),
      });
      const update = await updateResponse.json().catch(() => ({}));

      if (!updateResponse.ok) {
        throw new Error(update.error || "Unable to update settlement wallet.");
      }

      window.localStorage.setItem("settlement_wallet_address", newWalletAddress);
      onWalletUpdated(newWalletAddress);
      window.dispatchEvent(new Event("merchant_profile_updated"));
      setMessage("Settlement wallet updated.");
      setIsModalOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Wallet update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="space-y-3 md:col-span-2" aria-labelledby="settlement-address-label">
        <div className="flex items-center justify-between gap-3">
          <span id="settlement-address-label" className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Settlement Address
          </span>
          {message && <span className="text-xs text-emerald-300">{message}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-white">
            {currentWallet ? truncateAddress(currentWallet) : "Not configured"}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!currentWallet}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-full bg-purple-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-purple-400"
          >
            <ShieldCheck size={12} />
            Update Wallet
          </button>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-wallet-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Settlement wallet</p>
                <h2 id="update-wallet-title" className="mt-2 text-xl font-bold text-white">Connect a new wallet</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                aria-label="Close update wallet dialog"
                className="rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <WalletConnectPanel className="!h-11 !w-full !rounded-xl !bg-white !text-black !text-[10px] !font-black !uppercase !tracking-[0.2em] hover:!bg-zinc-200" />
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Connected target address</p>
                <p className="mt-2 truncate font-mono text-sm text-white">
                  {publicKey ? publicKey.toBase58() : "Connect a wallet to continue"}
                </p>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || !publicKey || !signMessage}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck size={14} />
                {isSubmitting ? "Confirming..." : "Sign & Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
