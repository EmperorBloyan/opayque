"use client";

import React, { useState, useEffect } from "react";
import { LucideX, LucideRefreshCw, LucideShieldCheck, LucideSmartphone, LucideClock } from "lucide-react";

export default function PairingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [pairingCode, setPairingCode] = useState("");
  const [expiry, setExpiry] = useState<number | null>(null);
  const [timeDisplay, setTimeDisplay] = useState("");

  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = Date.now() + 86400000;
    setPairingCode(code);
    setExpiry(newExpiry);
    localStorage.setItem("opayque_pairing_meta", JSON.stringify({ code, expiry: newExpiry }));
  };

  // Resilience: Load existing code if still valid
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("opayque_pairing_meta");
      if (saved) {
        const { code, expiry: savedExpiry } = JSON.parse(saved);
        if (Date.now() < savedExpiry) {
          setPairingCode(code);
          setExpiry(savedExpiry);
          return;
        }
      }
      generateCode();
    }
  }, [isOpen]);

  // Countdown Logic
  useEffect(() => {
    if (!expiry) return;
    const timer = setInterval(() => {
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setPairingCode("");
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeDisplay(`${h}h ${m}m`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-black/60 animate-in fade-in zoom-in duration-300">
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3.5rem] p-10 shadow-2xl">
        <button onClick={onClose} aria-label="Close Modal" className="absolute top-8 right-8 text-zinc-500 hover:text-white"><LucideX size={20} /></button>
        
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-600/10 rounded-full flex items-center justify-center mb-6 border border-purple-500/20"><LucideSmartphone className="text-purple-500" size={32} /></div>
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Pair Terminal</h2>
          
          <div className="w-full bg-black rounded-[2rem] border border-white/5 p-8 mb-4 relative">
            <span className="text-5xl font-mono font-black text-white">{pairingCode}</span>
            <button onClick={generateCode} className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-zinc-900 rounded-2xl text-zinc-400 hover:text-purple-400"><LucideRefreshCw size={18} /></button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-green-500/70"><LucideShieldCheck size={12} /><span className="text-[8px] font-black uppercase tracking-widest">TEE Active</span></div>
            <div className="flex items-center gap-1.5 text-zinc-500"><LucideClock size={12} /><span className="text-[8px] font-black uppercase tracking-widest italic">Expires in {timeDisplay}</span></div>
          </div>

          <button onClick={onClose} className="w-full mt-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px]">Close</button>
        </div>
      </div>
    </div>
  );
}