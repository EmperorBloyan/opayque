"use client";
import React, { useState, useEffect } from "react";
import { LucideHardDrive, LucidePlusCircle, LucideTrash2, LucideRefreshCw } from "lucide-react";

interface TerminalManagerProps {
  terminals: any[];
  setTerminals: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function TerminalManager({ terminals, setTerminals }: TerminalManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sample data + auto update on register
  useEffect(() => {
    if (terminals.length === 0) {
      const sample = [
        { id: "t1", label: "POS Terminal 01", status: "online" },
        { id: "t2", label: "Kiosk Terminal 02", status: "online" },
      ];
      setTerminals(sample);
      localStorage.setItem("opayque_terminals", JSON.stringify(sample));
    }
  }, [terminals.length, setTerminals]);

  const disconnectTerminal = (id: string) => {
    if (confirm("Unpair this terminal? New pairing code required to log in again.")) {
      const updated = terminals.filter(t => t.id !== id);
      setTerminals(updated);
      localStorage.setItem("opayque_terminals", JSON.stringify(updated));
    }
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] shadow-xl relative overflow-hidden group/fleet">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Hardware Fleet</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${terminals.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-800'}`} />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
              {terminals.length} SECURED NODES
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <LucideRefreshCw size={14} /> Refresh Code
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <LucidePlusCircle size={14} /> Pair New
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {terminals.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-5 bg-black/40 rounded-[2.5rem] border border-white/5 hover:border-purple-500/30 transition-all">
            <div className="flex items-center gap-3">
              <LucideHardDrive size={22} />
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-green-500">Online • TEE Secured</p>
              </div>
            </div>
            <button 
              onClick={() => disconnectTerminal(t.id)}
              className="text-red-500 hover:text-red-400 p-2"
            >
              <LucideTrash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
