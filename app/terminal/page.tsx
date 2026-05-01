"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function EnterpriseTerminal() {
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [staffName, setStaffName] = useState("Agent #001");

  // IMPROVEMENT: Get Mint from ENV
  const MINT = process.env.NEXT_PUBLIC_USDC_MINT || "Gh9ZwE9pk6fGst87fM7W6oY2i7m5wR8E3j28b9yWv352";

  // LOGIC: PAIRING VALIDATION
  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    const activeCode = localStorage.getItem('active_pairing_code');
    if (pairingCode === activeCode || pairingCode === "123456") { // "123456" as master backup for demo
      setStep("POS");
    } else {
      alert("Device not recognized. Check Merchant Admin for new code.");
    }
  };

  const triggerSuccess = () => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3").play();
    
    // RECORD TRANSACTION FOR ADMIN
    const newTx = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      staff: staffName,
      amount: parseFloat(amount),
      time: new Date().toLocaleTimeString()
    };
    const existing = JSON.parse(localStorage.getItem('opayque_tx') || '[]');
    localStorage.setItem('opayque_tx', JSON.stringify([newTx, ...existing]));

    setIsPaid(true);
    setTimeout(() => { setIsPaid(false); setStep("POS"); setAmount(""); }, 4000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        {step === "PAIRING" && (
          <div className="text-center animate-in fade-in zoom-in">
            <h1 className="text-3xl font-black italic mb-12">OPAYQUE TERMINAL</h1>
            <input 
              type="text" maxLength={6} placeholder="PAIRING CODE" value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-8 text-center text-5xl font-mono outline-none mb-6"
            />
            <button onClick={handlePairing} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs">Pair Device</button>
          </div>
        )}

        {step === "POS" && (
          <div className="bg-zinc-900 border border-white/5 rounded-[4rem] p-10 animate-in zoom-in">
             <div className="bg-black rounded-[3rem] p-12 mb-10 border border-white/5 shadow-inner">
                <p className="text-center text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-6">Enter Charge (USDC)</p>
                <div className="flex items-center justify-center">
                    <span className="text-2xl font-bold text-zinc-800 mr-2">$</span>
                    <input 
                        type="number" placeholder="0.00" value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full"
                    />
                </div>
            </div>
            <button onClick={() => setStep("PAYING")} className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-purple-500/20">CHARGE</button>
          </div>
        )}

        {step === "PAYING" && (
          <div className="text-center">
             {isPaid ? (
               <div className="animate-in zoom-in">
                  <div className="w-24 h-24 bg-white text-black rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl italic font-black">!</span></div>
                  <h2 className="text-5xl font-black italic">SETTLED</h2>
               </div>
             ) : (
               <div className="animate-in zoom-in cursor-pointer" onClick={triggerSuccess}>
                  <div className="p-8 bg-white rounded-[3.5rem] inline-block mb-8 border-[12px] border-zinc-900">
                    <QRCodeSVG 
                      value={`solana:${MINT}?amount=${amount}&label=Opayque`} 
                      size={200} level="H" 
                      imageSettings={{ src: "https://api.dicebear.com/7.x/avataaars/svg?seed=John", height: 50, width: 50, excavate: true }}
                    />
                  </div>
                  <h2 className="text-5xl font-mono font-bold mb-2">${parseFloat(amount).toFixed(2)}</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase animate-pulse">Scan to Pay</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
