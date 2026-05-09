"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EndpointRegistry from "@/components/EndpointRegistry";
import TerminalManager from "@/components/TerminalManager";
import ReportingHub from "@/components/ReportingHub";
import { Endpoint, Terminal } from "@/lib/types";
import { 
  LucideFingerprint, 
  LucideLock, 
  LucideFileSpreadsheet, 
  LucideTrash2, 
  LucideQrCode,
  LucideShieldCheck,
  LucideX,
  LucidePrinter
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function RegistryPage() {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReportHubOpen, setIsReportHubOpen] = useState(false);

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

  // Fix 7: Remove picture from QR overlay
  return (
    <div className="relative min-h-screen pb-20 animate-in fade-in duration-700">
      
      <div className="flex justify-between items-center mb-12 px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="group flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-all"
          >
            <LucideLock size={14} className="group-hover:animate-pulse" /> Lock Vault
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <LucideShieldCheck size={16} className="text-purple-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">TEE Session Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Identity Registration</h2>
            <EndpointRegistry onSave={handleSaveEndpoint} existingEndpoints={endpoints} />
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Hardware Fleet</h2>
            <TerminalManager terminals={terminals} setTerminals={setTerminals} />
          </section>
        </div>

        <div className="lg:col-span-8">
          <section className="bg-zinc-900/20 border border-white/5 rounded-[3.5rem] p-10 min-h-[700px] shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">Universal Registry</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Verified Recipient Database</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-xl">
                <span className="text-[10px] font-black text-purple-500 uppercase">{endpoints.length} Registered</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {endpoints.map((ep) => (
                <div key={ep.id} className="group bg-black/40 border border-white/5 p-6 rounded-[2.5rem] hover:border-purple-500/30 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl font-bold italic overflow-hidden border border-white/5">
                      {ep.name?.[0] || "O"}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm tracking-tight text-white">{ep.name}</p>
                      <p className="text-[9px] font-mono text-zinc-600 truncate w-32">{ep.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedEndpoint(ep)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all"
                    >
                      <LucideQrCode size={14} /> Identity Tag
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
          </section>
        </div>
      </div>

      {/* QR MODAL - Fix 7: No picture on QR */}
      {selectedEndpoint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 p-12 rounded-[4rem] max-w-sm w-full text-center relative shadow-2xl">
            <button onClick={() => setSelectedEndpoint(null)} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><LucideX size={24} /></button>
            
            <h3 className="text-2xl font-black italic uppercase mb-2 text-white">{selectedEndpoint.name}</h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-10">Opayque Protected Endpoint</p>
            
            <div className="relative p-8 bg-white rounded-[3rem] mb-10 inline-block mx-auto">
              <QRCodeSVG 
                value={`${window.location.origin}/vault/checkout?address=${selectedEndpoint.address}&name=${selectedEndpoint.name}`} 
                size={220}
                level="H"
              />
            </div>

            <button 
              onClick={() => window.print()}
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <LucidePrinter size={16} /> Print Identity Tag
            </button>
          </div>
        </div>
      )}

      <ReportingHub 
        isOpen={isReportHubOpen} 
        onClose={() => setIsReportHubOpen(false)} 
      />
    </div>
  );
}
EOFcat > app/vault/registry/page.tsx << 'EOF'
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EndpointRegistry from "@/components/EndpointRegistry";
import TerminalManager from "@/components/TerminalManager";
import ReportingHub from "@/components/ReportingHub";
import { Endpoint, Terminal } from "@/lib/types";
import { 
  LucideFingerprint, 
  LucideLock, 
  LucideFileSpreadsheet, 
  LucideTrash2, 
  LucideQrCode,
  LucideShieldCheck,
  LucideX,
  LucidePrinter
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function RegistryPage() {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReportHubOpen, setIsReportHubOpen] = useState(false);

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

  // Fix 7: Remove picture from QR overlay
  return (
    <div className="relative min-h-screen pb-20 animate-in fade-in duration-700">
      
      <div className="flex justify-between items-center mb-12 px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="group flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-all"
          >
            <LucideLock size={14} className="group-hover:animate-pulse" /> Lock Vault
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <LucideShieldCheck size={16} className="text-purple-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">TEE Session Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Identity Registration</h2>
            <EndpointRegistry onSave={handleSaveEndpoint} existingEndpoints={endpoints} />
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">Hardware Fleet</h2>
            <TerminalManager terminals={terminals} setTerminals={setTerminals} />
          </section>
        </div>

        <div className="lg:col-span-8">
          <section className="bg-zinc-900/20 border border-white/5 rounded-[3.5rem] p-10 min-h-[700px] shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">Universal Registry</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Verified Recipient Database</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-xl">
                <span className="text-[10px] font-black text-purple-500 uppercase">{endpoints.length} Registered</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {endpoints.map((ep) => (
                <div key={ep.id} className="group bg-black/40 border border-white/5 p-6 rounded-[2.5rem] hover:border-purple-500/30 transition-all duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl font-bold italic overflow-hidden border border-white/5">
                      {ep.name?.[0] || "O"}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm tracking-tight text-white">{ep.name}</p>
                      <p className="text-[9px] font-mono text-zinc-600 truncate w-32">{ep.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedEndpoint(ep)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all"
                    >
                      <LucideQrCode size={14} /> Identity Tag
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
          </section>
        </div>
      </div>

      {/* QR MODAL - Fix 7: No picture on QR */}
      {selectedEndpoint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 p-12 rounded-[4rem] max-w-sm w-full text-center relative shadow-2xl">
            <button onClick={() => setSelectedEndpoint(null)} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><LucideX size={24} /></button>
            
            <h3 className="text-2xl font-black italic uppercase mb-2 text-white">{selectedEndpoint.name}</h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-10">Opayque Protected Endpoint</p>
            
            <div className="relative p-8 bg-white rounded-[3rem] mb-10 inline-block mx-auto">
              <QRCodeSVG 
                value={`${window.location.origin}/vault/checkout?address=${selectedEndpoint.address}&name=${selectedEndpoint.name}`} 
                size={220}
                level="H"
              />
            </div>

            <button 
              onClick={() => window.print()}
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <LucidePrinter size={16} /> Print Identity Tag
            </button>
          </div>
        </div>
      )}

      <ReportingHub 
        isOpen={isReportHubOpen} 
        onClose={() => setIsReportHubOpen(false)} 
      />
    </div>
  );
}
