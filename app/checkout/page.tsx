"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { QRCodeSVG } from "qrcode.react";

export default function SmartCheckout() {
  const { publicKey, connected } = useWallet();
  
  const [mode, setMode] = useState<"checkout" | "tip" | "donation">("checkout");
  const [amount, setAmount] = useState<number>(10); 
  const [showQR, setShowQR] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // 1. DYNAMIC ADDRESS LOGIC
  // In production, this would come from a database or useSession()
  const merchantAddress = "5k1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmgp"; 
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Mainnet USDC

  // 2. SOLANA PAY URI SCHEME
  // Standard format: solana:<recipient>?amount=<amount>&spl-token=<mint>
  const paymentUrl = `solana:${merchantAddress}?amount=${amount}&spl-token=${USDC_MINT}&label=Opayque&message=Shielded+${mode}`;

  const handlePay = async () => {
    if (!publicKey) {
        setErrorMessage("Please connect your wallet first.");
        setStatus("error");
        return;
    }
    
    setStatus("processing");
    setErrorMessage("");

    try {
      const result = await buildShieldedTransfer(publicKey.toBase58(), merchantAddress, amount);
      if (result.error) throw new Error(result.error);
      
      setStatus("success");
      setTimeout(() => { setStatus("idle"); setShowQR(false); }, 4000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Transaction failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 border border-white/10 rounded-[2.5rem] bg-zinc-900 shadow-2xl relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/10 blur-[100px]"></div>

        {!showQR ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 text-center">
            <h2 className="text-4xl font-black italic tracking-tighter mb-10">OPAYQUE</h2>

            {/* 3. INLINE ERROR MESSAGE */}
            {status === "error" && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs animate-shake">
                ⚠️ {errorMessage}
              </div>
            )}

            <div className="bg-black/50 p-8 rounded-3xl mb-8 border border-white/5">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Set Price (USDC)</label>
              <input 
                type="number" 
                min="0" // 4. HTML5 VALIDATION
                value={amount}
                onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()} // 4. PREVENT NEGATIVES
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-transparent text-6xl font-mono font-bold text-center outline-none"
              />
            </div>

            <button 
              onClick={() => setShowQR(true)}
              className="w-full py-5 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-all text-lg"
            >
              Generate QR Code
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <h3 className="text-xl font-bold mb-6">Scan with Phantom</h3>
            
            <div className="p-6 bg-white rounded-[2rem] mb-8">
              <QRCodeSVG value={paymentUrl} size={200} />
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-center"><WalletMultiButton className="!bg-zinc-800" /></div>
              <button
                onClick={handlePay}
                disabled={!connected || status === "processing" || amount <= 0}
                className={`w-full py-4 rounded-2xl font-bold transition-all ${
                  status === "success" ? "bg-green-500 text-black" : "bg-purple-600 text-white disabled:opacity-20"
                }`}
              >
                {status === "idle" && `Confirm $${amount} Payment`}
                {status === "processing" && "Shielding..."}
                {status === "success" && "✅ Payment Complete"}
              </button>

              <button onClick={() => { setShowQR(false); setStatus("idle"); }} className="w-full text-zinc-600 text-[10px] font-bold uppercase">
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}