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
  const [isUrgent, setIsUrgent] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // 10 MINUTES: 10 * 60 * 1000 = 600,000ms
    const newExpiry = Date.now() + 600000; 
    
    setPairingCode(code);
    setExpiry(newExpiry);
    setCopied(false);
    setIsUrgent(false);

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

  useEffect(() => {
    if (!expiry) return;
    const timer = setInterval(() => {
      const diff = expiry - Date.now();
      
      if (diff <= 0) {
        setPairingCode("");
        localStorage.removeItem("active_pairing_code");
        clearInterval(timer);
        setTimeDisplay("EXPIRED");
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        // Trigger urgency at 1 minute remaining
        if (diff < 60000) setIsUrgent(true);
        
        setTimeDisplay(`${m}m ${s < 10 ? `0${s}` : s}s`);
      }
    }, 1000); // Updated to 1s for a real-time countdown feel
    return () => clearInterval(timer);
  }, [expiry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60 animate-in fade-in zoom-in duration-300">
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3.5rem] p-10 shadow-2xl overflow-hidden">
        
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/10 blur-3xl rounded-full" />

        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors"
        >
          <LucideX size={20} />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-purple-600/10 rounded-full flex items-center justify-center mb-6 border border-purple-500/20">
            <LucideSmartphone className="text-purple-500" size={32} />
          </div>
          
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2 italic text-white">Terminal Pairing</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-8 px-4">
            Security window active. Enter this code on your device.
          </p>
          
          <div className="w-full bg-black rounded-[2.5rem] border border-white/5 p-8 mb-6 flex items-center justify-between transition-all hover:border-white/10">
            <span className="text-5xl font-mono font-black text-white tracking-widest">
              {pairingCode || "------"}
            </span>
            
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                disabled={!pairingCode}
                className={`p-4 rounded-2xl transition-all ${copied ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {copied ? <LucideCheck size={20} /> : <LucideCopy size={20} />}
              </button>
              
              <button 
                onClick={generateCode} 
                className="p-4 bg-zinc-800 rounded-2xl text-zinc-400 hover:text-purple-400 transition-all"
              >
                <LucideRefreshCw size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-green-500/70">
              <LucideShieldCheck size={12} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">TEE Verified</span>
            </div>
            <div className={`flex items-center gap-1.5 transition-colors duration-500 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
              <LucideClock size={12} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">
                {isUrgent ? 'Expiring Soon: ' : 'Valid for: '}{timeDisplay}
              </span>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-full mt-12 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.25em] text-[10px] active:scale-95 transition-all shadow-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}