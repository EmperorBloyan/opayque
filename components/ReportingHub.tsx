"use client";

import React, { useState } from "react";
import { 
  LucideFileText, 
  LucideTable, 
  LucideDownload, 
  LucideX, 
  LucideShieldCheck 
} from "lucide-react";

export default function ReportingHub({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const getTxData = () => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("opayque_tx") || "[]");
    }
    return [];
  };

  // FUNCTIONAL AUDIT: CSV Export
  const exportCSV = () => {
    const txs = getTxData();
    if (txs.length === 0) return alert("No transaction data to export.");

    let csv = "TX_ID,RECIPIENT,AMOUNT_USDC,TIMESTAMP,PROTOCOL_STATUS\n";
    txs.forEach((tx: any) => {
      csv += `${tx.id},${tx.staff},${tx.amount},${tx.time},SHIELDED_TEE\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Opayque_Audit_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // MANAGEMENT REPORTING: High-fidelity Print
  const exportPDF = () => {
    setIsGenerating(true);
    setTimeout(() => {
      window.print();
      setIsGenerating(false);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden">
        
        <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors">
          <LucideX size={20} />
        </button>

        <header className="mb-12">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <LucideShieldCheck size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Compliance Protocol</span>
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Reporting Hub</h2>
          <p className="text-zinc-500 text-xs mt-2">Generate TEE-verified financial audits.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CSV OPTION */}
          <button 
            onClick={exportCSV}
            className="group flex flex-col items-start p-8 bg-black/40 border border-white/5 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600/20 group-hover:text-purple-400 transition-colors">
              <LucideTable size={24} />
            </div>
            <h3 className="font-black uppercase text-sm mb-2 tracking-tight text-white">Functional Audit</h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-8">
              Raw ledger data in .CSV format for external accounting and ERP reconciliation.
            </p>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-purple-500 tracking-widest">
              <LucideDownload size={12} /> Download CSV
            </div>
          </button>

          {/* PDF OPTION */}
          <button 
            onClick={exportPDF}
            className="group flex flex-col items-start p-8 bg-black/40 border border-white/5 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600/20 group-hover:text-purple-400 transition-colors">
              <LucideFileText size={24} className={isGenerating ? "animate-pulse" : ""} />
            </div>
            <h3 className="font-black uppercase text-sm mb-2 tracking-tight text-white">Management Report</h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-8">
              Formatted PDF summary with visual branding for executive review.
            </p>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-purple-500 tracking-widest">
              <LucideFileText size={12} /> {isGenerating ? "Processing..." : "Generate PDF"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
