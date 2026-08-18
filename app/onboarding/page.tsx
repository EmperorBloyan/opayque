"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function OnboardingPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markMerchantOnboarded = async () => {
    if (!publicKey) return;

    try {
      await fetch("/api/merchant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          wallet_address: publicKey.toBase58(),
          merchant_name: "Opayque Merchant",
          vaultInitialized: true,
        }),
      });
    } catch (registrationError) {
      console.warn("Unable to mark merchant as onboarded", registrationError);
    }
  };

  const handleEnterVault = async () => {
    if (!publicKey || !signTransaction) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request the backend relayer to build the transaction (Relayer set as feePayer)
      const res = await fetch("/api/relayer/build-initialize-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantPublicKey: publicKey.toBase58(),
          feeBps: 0,
          tokenDecimals: 6,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to build setup transaction.");
      }

      if (data.alreadyExists) {
        await markMerchantOnboarded();
        router.push("/vault/dashboard");
        return;
      }

      const txBuffer = Buffer.from(data.transaction, "base64");
      let signedTx: Transaction | VersionedTransaction;

      // 2. Deserialize & sign based on transaction format (Versioned vs Legacy)
      try {
        // Try parsing as VersionedTransaction first
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        signedTx = await signTransaction(versionedTx);
      } catch {
        // Fallback to Legacy Transaction
        const legacyTx = Transaction.from(txBuffer);
        signedTx = await signTransaction(legacyTx);
      }

      // 3. Broadcast transaction via RPC connection
      const rawTx = signedTx.serialize();
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // 4. Confirm transaction on-chain
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      await markMerchantOnboarded();

      // 5. Store session marker and redirect
      if (typeof window !== "undefined") {
        window.localStorage.setItem("settlement_wallet_address", publicKey.toBase58());
      }

      router.push("/vault/dashboard");
    } catch (err: any) {
      console.error("Vault initialization failed:", err);
      setError(err?.message || "Failed to initialize secured vault. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.12),transparent_40%)] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_45%)] pointer-events-none -z-10" />

      <div className="relative z-10 my-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-[2.5rem] border border-white/10 bg-[#0a0a0c]/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.1)] backdrop-blur-xl text-center">
          
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Gasless Setup</p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
            Enter Secured Vault
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Connect your merchant wallet. Protocol relayers will sponsor on-chain network fees for setup.
          </p>

          <div className="mt-8 space-y-4">
            {!connected ? (
              <div className="flex flex-col items-center gap-3">
                <WalletMultiButton className="!h-12 !w-full !justify-center !rounded-full !bg-white !text-black !text-xs !font-black !uppercase !tracking-[0.2em] hover:!bg-zinc-200 transition" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-left">
                  <span className="block text-[9px] uppercase tracking-wider text-zinc-500">Connected Merchant</span>
                  <span className="block truncate text-xs font-mono text-purple-300">
                    {publicKey?.toBase58()}
                  </span>
                </div>

                <button
                  onClick={handleEnterVault}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Initializing...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Vault</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-left text-xs text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <p className="mt-6 text-[10px] text-zinc-500">
            Vault initialization requires 1 wallet signature to confirm account ownership.
          </p>
        </div>
      </div>
    </main>
  );
}
