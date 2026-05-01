"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function EnterpriseTerminal() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Constants for Demo
  const MINT = process.env.NEXT_PUBLIC_USDC_MINT || "Gh9ZwE9pk6fGst87fM7W6oY2i7m5wR8E3j28b9yWv352";
  const STAFF_NAME = "Terminal #01";

  useEffect(() => {
    setMounted(true);
    // Check if device is already paired
    if (localStorage.getItem("terminal_paired") === "true") {
      setStep("POS");
    }
  }, []);

  // LOGIC: PAIRING HANDSHAKE
  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    const activeCode = localStorage.getItem("active_pairing_code");
    
    // Accept the dynamic code from Admin or a hardcoded master for emergencies
    if ((activeCode && pairingCode === activeCode) || pairingCode === "123456") {
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      // Clean up the code from the vault once consumed
      localStorage.removeItem("active_pairing_code");
    } else {
      setToast("Invalid Auth Token");
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  // LOGIC: RECORDING SETTLEMENT (Syncs with Admin)
  const triggerSuccess = useCallback(() => {
    if (isPaid) return;

    // UX: Success Feedback
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
    audio.volume = 0.4;
    audio.play().catch(() => {}); // Catch browser auto-play blocks

    // DATA: Shared Ledger Persistence
    const txAmount = parseFloat(amount) || 0;
    const newTx = {
      id: crypto.randomUUID().split("-")[0].toUpperCase(),
      staff: STAFF_NAME,
      amount: txAmount,
      time: new Date().toISOString()
    };

    // 1. Update Transaction History for Admin Ledger
    const existing = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
    localStorage.setItem("opayque_tx", JSON.stringify([newTx, ...existing]));

    // 2. Update Shielded Vault Balance for Admin Stats
    const currentBalance = Number(localStorage.getItem("opayque_balance") || "0");
    const updatedBalance = Number((currentBalance + txAmount).toFixed(2));
    localStorage.setItem("opayque_balance", String(updatedBalance));

    setIsPaid(true);
    
    // Auto-Reset for next customer after 4 seconds
    setTimeout(() => {
      setIsPaid(false);
      setStep("POS");
      setAmount("");
    }, 4000);
  }, [amount, isPaid]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-purple-500/30">
      <div className="w-full max-w-md">
        
        {/* STEP 1: DEVICE PAIRING */}
        {step === "PAIRING" && (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Opayque</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-12">Shielded Terminal</p>
            
            <form onSubmit={handlePairing}>
              <input 
                type="text" 
                maxLength={6} 
                placeholder="000000" 
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-6xl font-mono font-black outline-none mb-6 focus:border-purple-500/30 transition-all"
              />
              <button type="submit" className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-200 transition-all">
                Pair Device
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: POS KEYPAD */}
        {step === "POS" && (
          <div className="bg-zinc-900 border border-white/10 rounded-[4rem] p-10 animate-in slide-in-from-bottom duration-700">
             <div className="bg-black rounded-[3rem] p-12 mb-10 border border-white/5 shadow-2xl">
                <p className="text-center text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-6">Charge Amount (USDC)</p>
                <div className="flex items-center justify-center relative">
                    <span className="text-2xl font-bold text-zinc-800 absolute left-0">$</span>
                    <input 
                        type="number" 
                        placeholder="0.00" 
                        value={amount}
                        autoFocus
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full placeholder:text-zinc-900"
                    />
                </div>
            </div>
            <button 
                onClick={() => setStep("PAYING")} 
                disabled={!amount || parseFloat(amount) <= 0}
                className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl uppercase tracking-tighter shadow-[0_20px_50px_rgba(147,51,234,0.3)] hover:bg-purple-500 transition-all disabled:opacity-20"
            >
              Generate QR
            </button>
            <button 
                onClick={() => { localStorage.removeItem("terminal_paired"); setStep("PAIRING"); }}
                className="w-full mt-6 text-[9px] font-bold text-zinc-600 uppercase tracking-widest hover:text-zinc-400"
            >
                Unpair Device
            </button>
          </div>
        )}

        {/* STEP 3: PAYMENT SCREEN */}
        {step === "PAYING" && (
          <div className="text-center">
             {isPaid ? (
               <div className="animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                    <span className="text-4xl italic font-black">✓</span>
                  </div>
                  <h2 className="text-5xl font-black italic tracking-tighter uppercase">Settled</h2>
                  <p className="text-zinc-500 text-xs mt-4 font-mono">Shielded TX Broadcasted</p>
               </div>
             ) : (
               <div className="animate-in zoom-in duration-500">
                  <div className="p-10 bg-white rounded-[4rem] inline-block mb-10 border-[16px] border-zinc-900 shadow-2xl cursor-pointer active:scale-95 transition-transform" onClick={triggerSuccess}>
                    <QRCodeSVG 
                      value={`solana:usdc-mint-address-here?amount=${amount}&label=Opayque%20POS`} 
                      size={220} 
                      level="M" 
                    />
                  </div>
                  <h2 className="text-6xl font-mono font-bold tracking-tighter mb-2">${parseFloat(amount).toFixed(2)}</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] animate-pulse">Waiting for customer scan</p>
                  
                  {/* Demo Helper: Clicking the QR simulates a payment */}
                  <p className="mt-12 text-[8px] text-zinc-800 uppercase font-bold">(Tap QR to simulate payment for demo)</p>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-bottom">
          {toast}
        </div>
      )}
    </div>
  );
}
