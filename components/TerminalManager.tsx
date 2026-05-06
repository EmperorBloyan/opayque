"use client";

import React, { useState } from "react";
import { 
  LucideHardDrive, 
  LucidePlusCircle, 
  LucideActivity, 
  LucideWifi, 
  LucideTrash2, 
  LucideSettings, 
  LucideQrCode,
  LucideCheckCircle2
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

  // THE DE-PAIR LOGIC
  const disconnectTerminal = (id: string) => {
    if (confirm("De-authorize this hardware terminal? It will lose TEE access immediately.")) {
      const updated = terminals.filter(t => t.id !== id);
      setTerminals(updated);
      
      // Update Registry
      localStorage.setItem("opayque_terminals", JSON.stringify(updated));
      
      // Invalidate pairing if it matches the current active pairing
      const pairingMeta = localStorage.getItem("opayque_pairing_meta");
      if (pairingMeta) {
        localStorage.removeItem("opayque_pairing_meta");
        localStorage.removeItem("active_pairing_code");
      }
    }
  };

  const buildTerminalQR = (t: Terminal) => {
    // Ensuring the address is prioritized for the checkout flow
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      address: t.address || "",
      name: t.label,
      fixed: (t.fixedPrice || 0).toString(),
      image: t.image || ""
    });
    return `${baseUrl}/vault/checkout?${params.toString()}`;
  };

  const handleCopyLink = async (t: Terminal) => {
    const qrLink = buildTerminalQR(t);
    await navigator.clipboard.writeText(qrLink);
    setCopySuccess(t.id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3.5rem] shadow-xl relative overflow-hidden">
      
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">
            Hardware Fleet
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
          className="group flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
        >
          <LucidePlusCircle size={14} className="group-hover:rotate-90 transition-transform" /> 
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
                    <LucideWifi size={10} /> 5G_ENCRYPTED
                  </span>
                  <span className="text-green-500/60 flex items-center gap-1">
                    <LucideActivity size={10} /> TEE_ACTIVE
                  </span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleCopyLink(t)}
                  className={`p-2 transition-colors ${copySuccess === t.id ? 'text-green-500' : 'text-zinc-600 hover:text-purple-400'}`}
                >
                  {copySuccess === t.id ? <LucideCheckCircle2 size={16} /> : <LucideQrCode size={16} />}
                </button>
                <button 
                  onClick={() => disconnectTerminal(t.id)}
                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                >
                  <LucideTrash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
            <LucideHardDrive size={24} className="mx-auto mb-3 text-zinc-800" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700">No Terminals Authenticated</p>
          </div>
        )}
      </div>

      <PairingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}