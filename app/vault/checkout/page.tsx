"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { useOpayqueProgram } from "@/lib/use-opayque-program";
import { QRCodeSVG } from "qrcode.react";
import { 
  LucideShieldCheck, 
  LucideArrowLeft, 
  LucideCheckCircle2, 
  LucideLoader2,
  LucideAlertCircle 
} from "lucide-react";
import { Connection } from "@solana/web3.js";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { program } = useOpayqueProgram();

  const recipientAddress = searchParams.get("address") || "";
  const recipientName = searchParams.get("name") || "Opayque Recipient";
  const recipientImage = searchParams.get("image");
  const fixedAmount = searchParams.get("fixed");
  const isFixed = !!fixedAmount && fixedAmount !== "0";

  const [amount, setAmount] = useState<number>(isFixed ? Number(fixedAmount) : 10);
  const [showQR, setShowQR] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [txSignature, setTxSignature] = useState("");

  const playSuccessSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const handleShieldedPayment = async () => {
    if (!publicKey) {
      setStatus("error");
      setMessage("Please connect your wallet");
      return;
    }

    setStatus("processing");
    setMessage("Building shielded transaction...");

    try {
      // MagicBlock TEE Transaction (Main flow)
      const tx = await buildShieldedTransfer(
        publicKey.toBase58(), 
        recipientAddress, 
        amount
      );

      setMessage("Sending private transaction...");
      const signature = await sendTransaction(tx, null as any);

      setTxSignature(signature);
      setMessage(`Transaction submitted: ${signature.slice(0, 16)}...`);

      // Call your Anchor Program (non-blocking)
      if (program) {
        try {
          await program.methods
            .shieldedTransfer(new anchor.BN(Math.floor(amount * 1_000_000)), `Payment to ${recipientName}`)
            .accounts({
              merchant: publicKey,
              merchantAccount: publicKey, // Will improve PDA later
            })
            .rpc();
          console.log("✅ Anchor shielded_transfer logged successfully");
        } catch (anchorErr: any) {
          console.warn("Anchor call skipped (non-critical):", anchorErr.message);
        }
      }

      playSuccessSound();
      setStatus("success");

    } catch (err: any) {
      console.error("Payment error:", err);
      setStatus("error");
      setMessage(err.message || "Transaction failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-purple-500/30">
      <div className="w-full max-w-md bg-zinc-900/80 border border-white/5 rounded-[3.5rem] backdrop-blur-3xl shadow-2xl overflow-hidden relative">
        
        {/* PROGRESS HEADER */}
        <div className="pt-10 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
            <LucideShieldCheck size={12} className="text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400">
              {status === "success" ? "SETTLEMENT VERIFIED" : "SHIELDED SESSION"}
            </span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
            {recipientName}
          </h1>
        </div>

        {status === "success" ? (
          /* SUCCESS SCREEN - Your original design preserved */
          <div className="p-10 flex flex-col items-center text-center animate-in zoom-in duration-500">
            <div className="relative mb-8">
               <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse" />
               <div className="relative w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)]">
                  <LucideCheckCircle2 size={48} strokeWidth={3} />
               </div>
            </div>
            
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">PAID</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest max-w-[200px] leading-relaxed">
              Shielded transfer of <span className="text-white">${amount} USDC</span> finalized
            </p>
            
            {txSignature && (
              <p className="text-[10px] text-zinc-600 mt-6 break-all font-mono">{txSignature}</p>
            )}

            <button 
              onClick={() => window.location.reload()} 
              className="mt-12 w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              NEW TRANSACTION
            </button>
          </div>
        ) : !showQR ? (
          /* AMOUNT INPUT - Your original design */
          <div className="p-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-10 mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">
                {isFixed ? "FIXED TERMINAL TOTAL" : "SET AMOUNT (USDC)"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold text-zinc-700">$</span>
                <input 
                  type="number"
                  value={amount}
                  disabled={isFixed}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className={`bg-transparent text-7xl font-mono font-black outline-none w-full text-center ${isFixed ? 'text-zinc-500' : 'text-white'}`}
                />
              </div>
            </div>

            <button 
              onClick={() => setShowQR(true)}
              className="w-full py-6 bg-white text-black rounded-3xl font-black uppercase tracking-[0.2em] text-[12px] hover:bg-purple-500 hover:text-white transition-all shadow-xl active:scale-[0.98]"
            >
              CONFIRM SETTLEMENT
            </button>
          </div>
        ) : (
          /* QR + PAY SCREEN - Your original design */
          <div className="p-10 flex flex-col items-center animate-in zoom-in">
             <div className="relative p-6 bg-white rounded-[2.5rem] mb-10 shadow-2xl">
                <QRCodeSVG 
                  value={`solana:${recipientAddress}?amount=${amount}`} 
                  size={220} 
                  level="H" 
                  includeMargin={false} 
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="w-14 h-14 bg-black border-4 border-white rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden">
                     {recipientImage ? <img src={recipientImage} className="w-full h-full object-cover" /> : <span className="text-white font-black italic">O</span>}
                   </div>
                </div>
             </div>

             <div className="w-full space-y-3">
                <div className="flex justify-center"><WalletMultiButton className="!bg-zinc-800 !rounded-xl !h-12 !text-[10px] !font-black !uppercase" /></div>
                
                <button
                  onClick={handleShieldedPayment}
                  disabled={!connected || status === "processing"}
                  className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {status === "processing" ? (
                    <><LucideLoader2 className="animate-spin" size={16} /> PROCESSING...</>
                  ) : "FINALIZE WITH TEE"}
                </button>

                {message && status !== "success" && (
                  <p className="text-center text-sm text-zinc-400">{message}</p>
                )}

                <button onClick={() => setShowQR(false)} className="w-full py-2 text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white">
                  ← BACK
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmartCheckout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Initialising Shielded Session...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
