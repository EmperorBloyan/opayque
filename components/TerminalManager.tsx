"use client";

import React, { useState, useEffect } from "react";
import { LucideHardDrive, LucidePlusCircle, LucideActivity, LucideWifi, LucideTrash2, LucideSettings } from "lucide-react";
import PairingModal from "./PairingModal";
import { Terminal } from "@/lib/types";

export default function TerminalManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  // Load terminals from storage
  useEffect(() => {
    const saved = localStorage.getItem("opayque_terminals");
    if (saved) setTerminals(JSON.parse(saved));
    else {
      // Default initial terminal for demo
      const initial: Terminal = { id: 'term_042', label: 'Terminal_v1_042', status: 'online', lastSeen: Date.now() };
      setTerminals([initial]);
    }
  }, []);

  const disconnectTerminal = (id: string) => {
    const updated = terminals.filter(t => t.id !== id);
    setTerminals(updated);
    localStorage.setItem("opayque_terminals", JSON.stringify(updated));
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Hardware Fleet</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${terminals.some(t => t.status === 'online') ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              {terminals.length} {terminals.length === 1 ? 'Terminal' : 'Terminals'} Active
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          aria-label="Pair New Terminal"
          className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-400 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl"
        >
          <LucidePlusCircle size={14} /> Pair New
        </button>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {terminals.map((t) => (
          <div key={t.id} className="group flex items-center gap-4 p-5 bg-black/40 rounded-[2rem] border border-white/5 hover:border-purple-500/30 transition-all">
            <div className={`w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center ${t.status === 'online' ? 'text-purple-400' : 'text-zinc-700'}`}>
              <LucideHardDrive size={20} />
            </div>
            
            <div className="flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white">{t.label}</h4>
              <div className="flex items-center gap-3 mt-1 text-[8px] font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1 text-zinc-500">
                  <LucideWifi size={10} /> 5G Connected
                </span>
                <span className={`flex items-center gap-1 ${t.status === 'online' ? 'text-green-500/60' : 'text-zinc-600'}`}>
                  <LucideActivity size={10} /> TEE Synced
                </span>
              </div>
            </div>

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
        ))}
      </div>

      <PairingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}