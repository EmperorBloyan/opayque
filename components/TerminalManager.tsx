"use client";

import React, { useState } from "react";
import { 
  LucideHardDrive, 
  LucidePlusCircle, 
  LucideActivity, 
  LucideWifi, 
  LucideTrash2, 
  LucideSettings, 
  LucideQrCode 
} from "lucide-react";
import PairingModal from "./PairingModal";
import { Terminal } from "@/lib/types";

interface TerminalManagerProps {
  terminals: Terminal[];
  setTerminals: React.Dispatch<React.SetStateAction<Terminal[]>>;
}

export default function TerminalManager({ terminals, setTerminals }: TerminalManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const disconnectTerminal = (id: string) => {
    const updated = terminals.filter(t => t.id !== id);
    setTerminals(updated);
    localStorage.setItem("opayque_terminals", JSON.stringify(updated));
  };

  const buildTerminalQR = (t: Terminal) => {
    return `${window.location.origin}/vault/checkout?address=${t.address}&name=${encodeURIComponent(t.label)}&fixed=${t.fixedPrice || 0}&image=${encodeURIComponent(t.image || "")}`;
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] shadow-xl">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">
            Hardware Fleet
          </h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${terminals.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              {terminals.length} Connected
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          aria-label="Pair New Terminal"
          className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-400 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
        >
          <LucidePlusCircle size={14} /> Pair New
        </button>
      </div>

      <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
        {terminals.length > 0 ? (
          terminals.map((t) => (
            <div key={t.id} className="group flex items-center gap-4 p-5 bg-black/40 rounded-[2rem] border border-white/5 hover:border-purple-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-purple-400 overflow-hidden">
                {t.image ? (
                  <img src={t.image} alt={t.label} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <LucideHardDrive size={20} />
                )}
              </div>
              
              <div className="flex-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white">{t.label}</h4>
                <div className="flex items-center gap-3 mt-1 text-[8px] font-bold uppercase tracking-tighter">
                  <span className="flex items-center gap-1 text-zinc-500">
                    <LucideWifi size={10} /> 5G
                  </span>
                  <span className="text-green-500/60 flex items-center gap-1">
                    <LucideActivity size={10} /> TEE
                  </span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    const qrLink = buildTerminalQR(t);
                    navigator.clipboard.writeText(qrLink);
                    alert("Checkout QR link copied to clipboard!");
                  }}
                  className="p-2 text-zinc-600 hover:text-purple-500 transition-colors"
                  title="Copy QR Link"
                >
                  <LucideQrCode size={14} />
                </button>
                <button className="p-2 text-zinc-600 hover:text-white transition-colors" title="Diagnostics">
                  <LucideSettings size={14} />
                </button>
                <button 
                  onClick={() => disconnectTerminal(t.id)}
                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                  title="Disconnect"
                >
                  <LucideTrash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center border border-dashed border-white/5 rounded-[2rem]">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">No Hardware Paired</p>
          </div>
        )}
      </div>

      <PairingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}