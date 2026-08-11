"use client";

import React, { useState, useEffect } from "react";
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

export default function WebhooksPage() {
  const [endpointUrl, setEndpointUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load webhooks
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/webhooks');
        if (!res.ok) throw new Error('Failed to load webhooks');
        const data = await res.json();
        if (!mounted) return;
        setWebhooks(data.webhooks || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestWebhook = async (w: any) => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/v1/webhooks/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookId: w.id }) });
      if (!res.ok) throw new Error('Failed to dispatch test webhook');
      setToast('Dispatched signed HMAC test.ping payload — delivery logged');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setToast('Failed to dispatch test webhook');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const res = await fetch('/api/v1/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpointUrl: endpointUrl || '', environment: 'sandbox' }) });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      setWebhooks((cur) => [data, ...cur]);
      setWebhookSecret(data.rawSecret || null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/webhooks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setWebhooks((cur) => cur.filter((w) => w.id !== id));
    } catch (err) {
      console.error(err);
    }
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
                    <code className="text-zinc-400 font-mono text-[11px] truncate mr-2">{webhookSecret ?? '—'}</code>
                    <button 
                      onClick={() => webhookSecret && handleCopySecret(webhookSecret)}
                      className="text-purple-400 hover:text-purple-300 shrink-0 text-[10px] font-black uppercase"
                    >
                      {copied ? <LucideCheck size={14} /> : <LucideCopy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateWebhook}
                disabled={isTesting}
                className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LucideRefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                Create webhook
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
                Showing {webhooks.length} configured endpoints
              </span>
            </div>

            <div className="p-6 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md space-y-4">
              {webhooks.length === 0 && (
                <div className="p-6 rounded-2xl bg-black/50 text-zinc-400">No webhooks configured yet.</div>
              )}
              {webhooks.map((w) => (
                <div key={w.id} className="p-4 bg-black/40 border border-white/5 rounded-[1.5rem] flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-white truncate">{w.endpoint_url}</code>
                      <span className="text-[9px] text-zinc-400">{w.environment}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Created {new Date(w.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleSendTestWebhook(w)} className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs">Test</button>
                    <button onClick={() => handleCopySecret(w.rawSecret || w.endpoint_url)} className="px-3 py-2 rounded-lg bg-white/5 text-xs">Copy Secret</button>
                    <button onClick={() => handleDeleteWebhook(w.id)} className="px-3 py-2 rounded-lg bg-rose-700/10 text-rose-300 text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
      {toast && (
        <div role="status" className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}
