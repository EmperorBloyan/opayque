"use client";

import React, { useState, useEffect } from "react";
import { 
  LucideHardDrive, 
  LucidePlusCircle, 
  LucideActivity, 
  LucideWifi, 
  LucideTrash2, 
  LucideQrCode,
  LucideCheckCircle2,
  LucideBell
} from "lucide-react";
import PairingModal from "./PairingModal";
import { Terminal } from "@/lib/types";

interface TerminalManagerProps {
  terminals: Terminal[];
  setTerminals: React.Dispatch<React.SetStateAction<Terminal[]>>;
}

export default function TerminalManager({ terminals, setTerminals }: TerminalManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [lastTxCount, setLastTxCount] = useState(0);

  // 1. AUDITORY FEEDBACK: The POS "Ping"
  const playStaffNotification = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
    audio.volume = 0.4;
    audio.play().catch(e => console.warn("Audio play blocked until user interaction."));
  };

  // 2. LIVE MONITORING: Watch for incoming shielded settlements
  useEffect(() => {
    const checkTx = () => {
      const txs = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
      if (txs.length > lastTxCount && lastTxCount !== 0) {
        playStaffNotification();
        // Haptic feedback for mobile-based merchant dashboards
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
      }
      setLastTxCount(txs.length);
    };

    const interval = setInterval(checkTx, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, [lastTxCount]);

  const disconnectTerminal = (id: string) => {
    if (confirm("De-authorize this hardware terminal? It will lose TEE access immediately.")) {
      const updated = terminals.filter(t => t.id !== id);
      setTerminals(updated);
      localStorage.setItem("opayque_terminals", JSON.stringify(updated));
      
      localStorage.removeItem("opayque_pairing_meta");
      localStorage.removeItem("active_pairing_code");
    }
  };

  const handleCopyLink = async (t: Terminal) => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      address: t.address || "",
      name: t.label,
      fixed: (t.fixedPrice || 0).toString(),
      image: t.image || ""
    });
    const qrLink = `${baseUrl}/vault/checkout?${params.toString()}`;
    
    await navigator.clipboard.writeText(qrLink);
    setCopySuccess(t.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] shadow-xl relative overflow-hidden group/fleet">
      
      {/* Visual Accent */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/5 blur-[80px] -z-10 group-hover/fleet:bg-purple-600/10 transition-colors" />

      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1 flex items-center gap-2">
            Hardware Fleet <LucideBell size={10} className={lastTxCount > 0 ? "text-green-500 animate-bounce" : ""} />
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${terminals.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-800'}`} />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
              {terminals.length} SECURED NODES
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          <LucidePlusCircle size={14} /> 
          Pair New
        </button>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {terminals.length > 0 ? (
          terminals.map((t) => (
            <div key={t.id} className="group flex items-center gap-4 p-5 bg-black/40 rounded-[2.5rem] border border-white/5 hover:border-purple-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-purple-500 overflow-hidden shrink-0 border border-white/5">
                {t.image ? (
                  <img src={t.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <LucideHardDrive size={18} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-white truncate">{t.label}</h4>
                <div className="flex items-center gap-3 mt-1.5 text-[8px] font-bold uppercase tracking-tight">
                  <span className="flex items-center gap-1 text-zinc-500">
                    <LucideWifi size={10} /> 5G_SECURE
                  </span>
                  <span className="text-green-500/60 flex items-center gap-1">
                    <LucideActivity size={10} /> TEE_MONITOR
                  </span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleCopyLink(t)}
                  className={`p-2 transition-colors ${copySuccess === t.id ? 'text-green-500' : 'text-zinc-600 hover:text-purple-400'}`}
                  title="Copy Payment Link"
                >
                  {copySuccess === t.id ? <LucideCheckCircle2 size={16} /> : <LucideQrCode size={16} />}
                </button>
                <button 
                  onClick={() => disconnectTerminal(id)}
                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                  title="De-pair Terminal"
                >
                  <LucideTrash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
            <LucideHardDrive size={24} className="mx-auto mb-3 text-zinc-800 opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700">No Nodes Connected</p>
          </div>
        )}
      </div>

      <PairingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}