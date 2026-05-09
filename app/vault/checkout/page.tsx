"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { Connection } from "@solana/web3.js";
import { LucideShieldCheck, LucideLoader2, LucideCheckCircle2 } from "lucide-react";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { publicKey, signTransaction, connected } = useWallet();

  const recipientAddress = searchParams.get("address") || "8YAV5vV3Nf2zPx9WCjyqkFKTAa55Hjnhm8FDCAEHEM76";
  const recipientName = searchParams.get("name") || "Opayque Recipient";
  const fixedAmount = searchParams.get("fixed");
  const isFixed = !!fixedAmount && fixedAmount !== "0";

  const [amount, setAmount] = useState<number>(isFixed ? Number(fixedAmount) : 50);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [txSignature, setTxSignature] = useState("");

  const handleShieldedPayment = async () => {
    if (!publicKey || !signTransaction) {
      setStatus("error");
      setMessage("Please connect your wallet");
      return;
    }

    setStatus("processing");
    setMessage("Building shielded transaction...");

    try {
      const tx = await buildShieldedTransfer(publicKey.toBase58(), recipientAddress, amount);

      setMessage("Signing transaction...");
      const signedTx = await signTransaction(tx);

      setMessage("Finalizing with TEE...");
      const connection = new Connection("https://devnet-tee.magicblock.app", "confirmed");
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
        skipPreflight: true 
      });

      setTxSignature(signature);
      setStatus("success");
      setMessage("Shielded transfer completed");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "Transaction failed");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900/80 border border-white/5 rounded-[3.5rem] backdrop-blur-3xl shadow-2xl overflow-hidden relative">
        {/* Your original header and design preserved */}
        <div className="pt-10 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
            <LucideShieldCheck size={12} className="text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400">SHIELDED SESSION</span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
            {recipientName}
          </h1>
        </div>

        {status === "success" ? (
          <div className="p-10 flex flex-col items-center text-center">
            <LucideCheckCircle2 size={80} className="text-green-500 mb-6" />
            <h2 className="text-4xl font-black">PAID</h2>
            <p className="text-zinc-500 mt-2">$${amount} USDC shielded successfully</p>
            {txSignature && <p className="text-[10px] text-zinc-600 mt-6 break-all">{txSignature}</p>}
          </div>
        ) : (
          <div className="p-10">
            <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-10 mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">
                {isFixed ? "FIXED AMOUNT" : "ENTER AMOUNT"}
              </p>
              <input 
                type="number"
                value={amount}
                disabled={isFixed}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="bg-transparent text-7xl font-mono font-black outline-none w-full text-center"
              />
            </div>

            <button 
              onClick={handleShieldedPayment}
              disabled={!connected || status === "processing"}
              className="w-full py-6 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white rounded-3xl font-black uppercase tracking-widest text-sm transition-all"
            >
              {status === "processing" ? (
                <span className="flex items-center justify-center gap-3">
                  <LucideLoader2 className="animate-spin" size={18} /> FINALIZING WITH TEE...
                </span>
              ) : "FINALIZE WITH TEE"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmartCheckout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center">Loading Shielded Session...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
