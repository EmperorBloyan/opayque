"use client";

import React, { useState } from "react";
import { 
  LucideWebhook, 
  LucideActivity, 
  LucideRefreshCw, 
  LucideCheckCircle2, 
  LucideXCircle, 
  LucideCopy, 
  LucideCheck,
  LucideShieldCheck,
  LucideRadio
} from "lucide-react";

interface WebhookLog {
  id: string;
  event: string;
  status: number;
  url: string;
  timestamp: string;
  duration: string;
}

const INITIAL_LOGS: WebhookLog[] = [
  {
    id: "evt_99a81f01",
    event: "checkout.session.completed",
    status: 200,
    url: "https://api.merchant.com/v1/opayque-webhook",
    timestamp: "2026-08-10 09:32:11",
    duration: "142ms"
  },
  {
    id: "evt_99a81f02",
    event: "tx.shielded.settled",
    status: 200,
    url: "https://api.merchant.com/v1/opayque-webhook",
    timestamp: "2026-08-10 09:28:45",
    duration: "98ms"
  },
  {
    id: "evt_99a81f03",
    event: "terminal.node.paired",
    status: 500,
    url: "https://api.merchant.com/v1/opayque-webhook",
    timestamp: "2026-08-10 08:15:02",
    duration: "502ms"
  }
];

export default function WebhooksPage() {
  const [endpointUrl, setEndpointUrl] = useState("https://api.merchant.com/v1/opayque-webhook");
  const [webhookSecret] = useState("whsec_sol_99x82a10f_live_hash");
  const [logs, setLogs] = useState<WebhookLog[]>(INITIAL_LOGS);
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestWebhook = () => {
    setIsTesting(true);
    setTimeout(() => {
      const newLog: WebhookLog = {
        id: `evt_${Math.random().toString(36).substring(2, 9)}`,
        event: "checkout.session.simulated",
        status: 200,
        url: endpointUrl,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        duration: "115ms"
      };
      setLogs([newLog, ...logs]);
      setIsTesting(false);
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Ambient Visuals */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <LucideWebhook size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Realtime Telemetry</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white">
            Webhook Event Stream
          </h1>
          <p className="text-zinc-500 text-xs mt-3 uppercase tracking-widest font-bold">
            Configure automated event listeners, signing secrets, and delivery logs.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Configuration Settings */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Endpoint Config Card */}
            <div className="p-8 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/40 rounded-2xl flex items-center justify-center border border-white/5 text-purple-500">
                  <LucideRadio size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Destination Endpoint</h3>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">HTTP POST Target</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
                    Target URL
                  </label>
                  <input 
                    type="url" 
                    value={endpointUrl} 
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
                    Signing Secret (HMAC-SHA256)
                  </label>
                  <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-2xl p-4">
                    <code className="text-zinc-400 font-mono text-[11px] truncate mr-2">{webhookSecret}</code>
                    <button 
                      onClick={handleCopySecret}
                      className="text-purple-400 hover:text-purple-300 shrink-0 text-[10px] font-black uppercase"
                    >
                      {copied ? <LucideCheck size={14} /> : <LucideCopy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSendTestWebhook}
                disabled={isTesting}
                className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LucideRefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                {isTesting ? "Dispatching..." : "Test Webhook Trigger"}
              </button>
            </div>

            {/* Security Badge */}
            <div className="p-6 rounded-[2.5rem] bg-purple-900/10 border border-purple-500/20 flex items-center gap-4">
              <LucideShieldCheck size={28} className="text-purple-400 shrink-0" />
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-300">TEE Signature Verification</h4>
                <p className="text-[9px] text-zinc-400 leading-relaxed mt-1">
                  All webhook payloads are cryptographically signed using SGX/TDX enclave headers.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Live Event Stream Logs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <LucideActivity size={14} className="text-purple-400" /> Dispatch Audit Logs
              </span>
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
                Showing last {logs.length} events
              </span>
            </div>

            <div className="p-6 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md space-y-4">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-5 bg-black/40 border border-white/5 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {log.status === 200 ? (
                        <LucideCheckCircle2 size={18} className="text-green-400" />
                      ) : (
                        <LucideXCircle size={18} className="text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-white">{log.event}</code>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black ${
                          log.status === 200 
                            ? "bg-green-500/10 border border-green-500/20 text-green-400" 
                            : "bg-red-500/10 border border-red-500/20 text-red-400"
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1 truncate max-w-xs">{log.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 text-right">
                    <div>
                      <div className="text-[10px] font-mono text-zinc-400">{log.timestamp}</div>
                      <div className="text-[9px] font-mono text-zinc-600">{log.duration} latency</div>
                    </div>
                    <code className="text-[10px] font-mono text-purple-400 bg-purple-900/20 px-2 py-1 rounded-lg border border-purple-500/20">
                      {log.id}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
