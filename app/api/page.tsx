"use client";

import React, { useState } from "react";
import { 
  LucideTerminal, 
  LucideSend, 
  LucideCode, 
  LucideCopy, 
  LucideCheckCircle, 
  LucideShield, 
  LucideLock,
  LucideZap
} from "lucide-react";

interface EndpointDoc {
  id: string;
  method: "POST" | "GET" | "DELETE";
  path: string;
  description: string;
  sampleBody: string;
  sampleResponse: string;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    id: "session",
    method: "POST",
    path: "/api/v1/sessions",
    description: "Initiates a shielded checkout session with locked order metadata.",
    sampleBody: JSON.stringify({ order_id: "ORD-8821", amount_fiat: 150.00, currency: "USD" }, null, 2),
    sampleResponse: JSON.stringify({ success: true, data: { session_id: "sess_99x82a10f", status: "PENDING" } }, null, 2)
  },
  {
    id: "tx-compile",
    method: "POST",
    path: "/api/v1/checkout/transaction",
    description: "Compiles atomic Solana mainnet instruction payload with 99.5% / 0.5% fee split.",
    sampleBody: JSON.stringify({ session_id: "sess_99x82a10f", customer_wallet_address: "Cust...1111", merchant_wallet_address: "Merch...9999", amount_usdc: 150.00 }, null, 2),
    sampleResponse: JSON.stringify({ success: true, transaction_base64: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...", fee_split: { merchant: 149.25, protocol: 0.75 } }, null, 2)
  },
  {
    id: "pairing",
    method: "POST",
    path: "/api/terminal/pairing",
    description: "Generates or verifies 6-digit hardware node authorization pairing codes.",
    sampleBody: JSON.stringify({ action: "create", merchant_id: "merch_uuid_here", terminal_label: "Register-01" }, null, 2),
    sampleResponse: JSON.stringify({ success: true, code: "X7K9P2", expiresAt: "2026-08-10T10:00:00Z" }, null, 2)
  }
];

export default function ApiExplorer() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);

  const handleCopyCurl = () => {
    const curl = `curl -X ${selectedEndpoint.method} https://opayque.com${selectedEndpoint.path} \\
  -H "Authorization: Bearer opq_live_9x8f7d6e5c4b3a210" \\
  -H "Content-Type: application/json" \\
  -d '${selectedEndpoint.sampleBody.replace(/\n/g, "")}'`;
    
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestRequest = () => {
    setIsSimulating(true);
    setResponseOutput(null);
    setTimeout(() => {
      setResponseOutput(selectedEndpoint.sampleResponse);
      setIsSimulating(false);
    }, 800);
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Ambient Visuals */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <LucideTerminal size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Protocol Specs</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white">
            API Route Inspector
          </h1>
          <p className="text-zinc-500 text-xs mt-3 uppercase tracking-widest font-bold">
            Interactive endpoint reference and payload testing console.
          </p>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Endpoint Navigation list */}
          <div className="lg:col-span-4 space-y-4">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2">Available Endpoints</p>
            <div className="space-y-3">
              {ENDPOINTS.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEndpoint(ep);
                    setResponseOutput(null);
                  }}
                  className={`w-full p-5 rounded-[2rem] border text-left transition-all flex flex-col gap-2 ${
                    selectedEndpoint.id === ep.id
                      ? "bg-zinc-900 border-purple-500/50 shadow-xl shadow-purple-500/10"
                      : "bg-black/40 border-white/5 hover:border-white/20 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-400 font-mono text-[9px] font-black tracking-widest">
                      {ep.method}
                    </span>
                    <LucideZap size={14} className={selectedEndpoint.id === ep.id ? "text-purple-400" : "text-zinc-600"} />
                  </div>
                  <code className="text-xs font-mono text-white font-bold tracking-tight">{ep.path}</code>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Payload & Test Console */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="p-8 md:p-10 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md space-y-8">
              
              {/* Active Endpoint Overview */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-purple-600/20 text-purple-400 font-mono text-xs font-black">
                      {selectedEndpoint.method}
                    </span>
                    <code className="text-lg font-mono font-bold text-white">{selectedEndpoint.path}</code>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{selectedEndpoint.description}</p>
                </div>

                <button
                  onClick={handleCopyCurl}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-black/60 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-purple-500/50 transition-all"
                >
                  {copied ? <LucideCheckCircle size={14} className="text-purple-400" /> : <LucideCopy size={14} />}
                  {copied ? "cURL Copied" : "Copy cURL"}
                </button>
              </div>

              {/* Body Payload Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Request Body (JSON)</span>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                    <LucideLock size={12} /> Bearer Auth Enforced
                  </div>
                </div>
                <div className="bg-black/60 border border-white/10 rounded-2xl p-5 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{selectedEndpoint.sampleBody}</pre>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleTestRequest}
                disabled={isSimulating}
                className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LucideSend size={14} className={isSimulating ? "animate-pulse" : ""} />
                {isSimulating ? "Transmitting Payload..." : "Execute Test Request"}
              </button>

              {/* Response Inspector */}
              {responseOutput && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Response Inspector</span>
                    <span className="text-[9px] font-mono text-green-400 uppercase tracking-widest">200 OK • API Response</span>
                  </div>
                  <div className="bg-black/80 border border-green-500/20 rounded-2xl p-5 font-mono text-xs text-green-400 overflow-x-auto">
                    <pre>{responseOutput}</pre>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
