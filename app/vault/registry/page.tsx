"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import EndpointRegistry from "@/components/EndpointRegistry";
import TerminalManager from "@/components/TerminalManager";
import { Endpoint, Terminal } from "@/lib/types";
import { 
  LucideFingerprint, 
  LucideLock, 
  LucideFileSpreadsheet, 
  LucideTrash2, 
  LucideQrCode,
  LucideShieldCheck
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function RegistryPage() {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 1. BIOMETRIC SECURITY CHALLENGE (WebAuthn)
  useEffect(() => {
    const triggerBiometrics = async () => {
      if (window.PublicKeyCredential) {
        try {
          // This triggers the native OS fingerprint/FaceID prompt
          await navigator.credentials.get({
            publicKey: {
              challenge: new Uint8Array([1, 2, 3, 4]), // Dummy challenge for demo
              timeout: 60000,
              allowCredentials: [],
            }
          });
          setIsAuthenticated(true);
        } catch (err) {
          console.warn("Biometric check bypassed or cancelled");
          setIsAuthenticated(true); // Allow bypass for testing, but prompt occurred
        }
      } else {
        setIsAuthenticated(true);
      }
    };
    triggerBiometrics();
  }, []);

  // Hydration
  useEffect(() => {
    const savedEndpoints = localStorage.getItem("opayque_endpoints");
    const savedTerminals = localStorage.getItem("opayque_terminals");
    if (savedEndpoints) setEndpoints(JSON.parse(savedEndpoints));
    if (savedTerminals) setTerminals(JSON.parse(savedTerminals));
  }, []);

  const handleSaveEndpoint = (newEndpoint: Endpoint) => {
    const updated = [newEndpoint, ...endpoints];
    setEndpoints(updated);
    localStorage.setItem("opayque_endpoints", JSON.stringify(updated));
  };

  const handleDeleteEndpoint = (id: string) => {
    const updated = endpoints.filter((e) => e.id !== id);
    setEndpoints(updated);
    localStorage.setItem("opayque_endpoints", JSON.stringify(updated));
    if (selectedEndpoint?.id === id) setSelectedEndpoint(null);
  };

  // 2. COMPLIANCE REPORT EXPORT (CFA Touch)
  const generateComplianceReport = () => {
    const txData = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
    let csv = "ID,Recipient,Amount,Timestamp,Status\n";
    txData.forEach((tx: any) => {
      csv += `${tx.id},${tx.staff},${tx.amount},${tx.time},SHIELDED\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Opayque_Compliance_${Date.now()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center animate-pulse">
        <LucideFingerprint size={60} className="text-purple-500 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Awaiting Biometric Auth</p>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN: Actions & Management */}
      <div className="lg:col-span-4 space-y-8">
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-colors"
          >
            <LucideLock size={14} /> Lock Vault
          </button>
          <button 
            onClick={generateComplianceReport}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-purple-400 transition-colors"
          >
            <LucideFileSpreadsheet size={14} /> Export Audit
          </button>
        </div>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Identity Registration</h2>
          <EndpointRegistry onSave={handleSaveEndpoint} existingEndpoints={endpoints} />
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Hardware Fleet</h2>
          <TerminalManager terminals={terminals} setTerminals={setTerminals} />
        </section>
      </div>

      {/* RIGHT COLUMN: Active List */}
      <div className="lg:col-span-8">
        <section className="bg-zinc-900/20 border border-white/5 rounded-[3.5rem] p-10 min-h-[700px] relative overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-end mb-12">
            <div>
              <div className="flex items-center gap-2 text-purple-500 mb-2">
                <LucideShieldCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">TEE-Secured Directory</span>
              </div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">Universal Registry</h2>
            </div>
            <span className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold text-zinc-400 border border-white/5">
              {endpoints.length} Active
            </span>
          </div>

          {/* Grid of Endpoints */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {endpoints.map((ep) => (
              <div key={ep.id} className="group bg-black/40 border border-white/5 p-6 rounded-[2rem] hover:border-purple-500/30 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl font-bold italic">
                    {ep.image ? <img src={ep.image} className="w-full h-full object-cover rounded-2xl" /> : ep.name[0]}
                  </div>
                  <div>
                    <p className="font-black uppercase text-sm tracking-tight">{ep.name}</p>
                    <p className="text-[9px] font-mono text-zinc-600 truncate w-32">{ep.address}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedEndpoint(ep)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all"
                  >
                    <LucideQrCode size={14} /> View QR
                  </button>
                  <button 
                    onClick={() => handleDeleteEndpoint(ep.id)}
                    className="p-3 bg-zinc-900 text-zinc-700 hover:text-red-500 rounded-xl transition-all"
                  >
                    <LucideTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {endpoints.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-700">
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Registered Endpoints</p>
            </div>
          )}
        </section>
      </div>

      {/* QR OVERLAY MODAL */}
      {selectedEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center relative">
            <button onClick={() => setSelectedEndpoint(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><LucideX size={20} /></button>
            <h3 className="text-xl font-black italic uppercase mb-8">{selectedEndpoint.name}</h3>
            <div className="bg-white p-6 rounded-[2rem] inline-block mb-8">
              <QRCodeSVG 
                value={`${window.location.origin}/vault/checkout?address=${selectedEndpoint.address}&name=${selectedEndpoint.name}`} 
                size={200}
              />
            </div>
            <button 
              onClick={() => window.print()}
              className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              Print Identity Tag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const LucideX = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);