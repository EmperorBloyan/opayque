"use client";

import React, { useState, useEffect } from "react";
import { 
  LucideX, 
  LucideRefreshCw, 
  LucideShieldCheck, 
  LucideSmartphone, 
  LucideClock, 
  LucideCopy, 
  LucideCheck 
} from "lucide-react";

export default function PairingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [pairingCode, setPairingCode] = useState("");
  const [expiry, setExpiry] = useState<number | null>(null);
  const [timeDisplay, setTimeDisplay] = useState("");
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = Date.now() + 86400000; // 24 hours
    setPairingCode(code);
    setExpiry(newExpiry);
    setCopied(false);
    // Sync with the key expected by EnterpriseTerminal.tsx
    localStorage.setItem("active_pairing_code", code);
    localStorage.setItem("opayque_pairing_meta", JSON.stringify({ code, expiry: newExpiry }));
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
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
        localStorage.removeItem("active_pairing_code");
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeDisplay(`${h}h ${m}m`);
      }
    }, 10000); // Check every 10s for performance
    return () => clearInterval(timer);
  }, [expiry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60 animate-in fade-in zoom-in duration-300">
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3.5rem] p-10 shadow-2xl overflow-hidden">
        
        {/* Glow Decor */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/10 blur-3xl rounded-full" />

        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors"
        >
          <LucideX size={20} />
        </button>
        
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-600/10 rounded-full flex items-center justify-center mb-6 border border-purple-500/20">
            <LucideSmartphone className="text-purple-500" size={32} />
          </div>
          
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2 italic text-white">Terminal Auth</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-8 text-center px-4">
            Enter this code on your hardware terminal to link it to the vault
          </p>
          
          <div className="w-full bg-black rounded-[2.5rem] border border-white/5 p-8 mb-6 flex items-center justify-between group transition-all hover:border-white/10">
            <span className="text-5xl font-mono font-black text-white tracking-widest">
              {pairingCode}
            </span>
            
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className={`p-4 rounded-2xl transition-all ${copied ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                title="Copy to Clipboard"
              >
                {copied ? <LucideCheck size={20} /> : <LucideCopy size={20} />}
              </button>
              
              <button 
                onClick={generateCode} 
                className="p-4 bg-zinc-800 rounded-2xl text-zinc-400 hover:text-purple-400 transition-all"
                title="Refresh Code"
              >
                <LucideRefreshCw size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-green-500/70">
              <LucideShieldCheck size={12} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">TEE Secured</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-500">
              <LucideClock size={12} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">Expires: {timeDisplay}</span>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-full mt-12 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.25em] text-[10px] active:scale-95 transition-all shadow-xl"
          >
            Finish Setup
          </button>
        </div>
      </div>
    </div>
  );
}