"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Check, CheckCircle2, Copy, Eye, EyeOff, Radio, RefreshCw, ShieldCheck, Webhook, XCircle } from "lucide-react";

interface DeliveryLog {
  id: string;
  event: string;
  status: number;
  endpoint: string;
  time: string;
  latency: string;
}

const eventTypes = [
  "checkout.session.completed", 
  "tx.shielded.settled", 
  "terminal.node.paired", 
  "transfer.failed"
];

export default function WebhooksDeliveryLogsPage() {
  const [endpoint, setEndpoint] = useState("");
  const [secret, setSecret] = useState<string>("whsec_loading...");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  
  const [isTesting, setIsTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch Initial Config & Logs
  const fetchTelemetryData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Logs
      const logsRes = await fetch('/api/v1/webhooks/logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }

      // Fetch Config (Endpoint, Secret, Subscribed Events)
      const configRes = await fetch('/api/v1/webhooks/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.endpoint) setEndpoint(configData.endpoint);
        if (configData.secret) setSecret(configData.secret);
        if (configData.events) setSelectedEvents(configData.events);
      }
    } catch (err) {
      console.error("Failed to load telemetry data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetryData();
  }, [fetchTelemetryData]);

  // 2. Save Configuration (Fires on Blur or Event Toggle)
  const updateConfiguration = async (newEndpoint: string, newEvents: string[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/v1/webhooks/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: newEndpoint, events: newEvents })
      });
    } catch (err) {
      console.error("Failed to save configuration:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndpointBlur = () => {
    updateConfiguration(endpoint, selectedEvents);
  };

  const toggleEvent = (event: string) => {
    const updatedEvents = selectedEvents.includes(event) 
      ? selectedEvents.filter((item) => item !== event) 
      : [...selectedEvents, event];
    
    setSelectedEvents(updatedEvents);
    updateConfiguration(endpoint, updatedEvents);
  };

  const copySecret = async () => { 
    if (!secret || secret.includes("loading")) return;
    await navigator.clipboard.writeText(secret); 
    setCopied(true); 
    window.setTimeout(() => setCopied(false), 1600); 
  };

  // 3. Dispatch Live Test Webhook
  const sendTest = async () => {
    if (!endpoint) return;
    setIsTesting(true);
    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, events: selectedEvents })
      });
      
      if (!res.ok) throw new Error('Failed to dispatch test webhook');
      
      // Refresh logs to show the new test delivery attempt
      await fetchTelemetryData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  // 4. Retry Failed Delivery
  const retry = async (id: string) => {
    try {
      // Optimistic UI update (optional, but makes it feel instant)
      setLogs((current) => current.map((log) => 
        log.id === id ? { ...log, status: 0, latency: "retrying..." } : log
      ));

      const res = await fetch(`/api/v1/webhooks/retry/${id}`, { 
        method: 'POST' 
      });
      
      if (!res.ok) throw new Error('Retry failed');
      
      // Pull fresh logs to get the definitive retry status
      await fetchTelemetryData();
    } catch (err) {
      console.error("Webhook retry failed:", err);
      await fetchTelemetryData(); // Revert optimistic update on fail
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <header className="space-y-2 border-b border-white/5 pb-8">
        <div className="flex items-center gap-2 text-purple-500">
          <Webhook size={16} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Realtime Telemetry</span>
        </div>
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white md:text-5xl">
          Webhooks &amp; Delivery Logs
        </h2>
        <p className="max-w-2xl text-xs font-bold uppercase tracking-widest text-zinc-500">
          Configure signed event delivery and inspect every attempt from one protected workspace.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-4">
          <div className="space-y-6 rounded-[3rem] border border-white/5 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-sm relative">
            {/* Optional Saving Indicator */}
            {isSaving && (
              <div className="absolute top-8 right-8 flex items-center gap-2 text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                <RefreshCw size={10} className="animate-spin" /> Saving
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-black/40 text-purple-500">
                <Radio size={20} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest">Webhook Endpoint</h3>
                <p className="mt-1 text-[9px] uppercase tracking-widest text-zinc-500">HTTP POST target</p>
              </div>
            </div>
            
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">
              Destination URL
              <input 
                type="url" 
                value={endpoint} 
                onChange={(event) => setEndpoint(event.target.value)} 
                onBlur={handleEndpointBlur}
                placeholder="https://your-domain.com/api/webhooks"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-xs font-mono text-zinc-200 outline-none transition focus:border-purple-500/50 placeholder:text-zinc-700" 
              />
            </label>
            
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">
              Signing Secret
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-4">
                <code className="min-w-0 flex-1 truncate text-[11px] font-mono text-zinc-400">
                  {showSecret ? secret : "whsec_••••••••••••••••••••••••"}
                </code>
                <button type="button" onClick={() => setShowSecret((value) => !value)} className="text-zinc-500 hover:text-white transition-colors" aria-label="Toggle signing secret visibility">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button type="button" onClick={copySecret} className="text-purple-400 hover:text-purple-300 transition-colors" aria-label="Copy signing secret">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </label>
            
            <button 
              type="button" 
              onClick={sendTest} 
              disabled={isTesting || !endpoint} 
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] transition hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
              {isTesting ? "Dispatching..." : "Test Webhook"}
            </button>
          </div>

          <div className="rounded-[2.5rem] border border-purple-500/20 bg-purple-900/10 p-6">
            <div className="flex items-center gap-4">
              <ShieldCheck size={28} className="shrink-0 text-purple-400" />
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-300">Subscribed Events</h4>
                <p className="mt-1 text-[9px] leading-relaxed text-zinc-400">Choose which signed events reach your endpoint.</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {eventTypes.map((event) => (
                <label key={event} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-[10px] font-mono text-zinc-300 cursor-pointer hover:bg-black/40 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedEvents.includes(event)} 
                    onChange={() => toggleEvent(event)} 
                    className="accent-purple-500 w-3 h-3" 
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between px-2">
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <Activity size={14} className="text-purple-400" /> Delivery history
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
              {loading ? 'Syncing...' : `${logs.length} attempts`}
            </span>
          </div>
          
          <div className="overflow-hidden rounded-[3rem] border border-white/5 bg-zinc-900/50 shadow-2xl backdrop-blur-sm">
            <div className="hidden grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_auto] gap-4 border-b border-white/5 px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-600 md:grid">
              <span>Event</span>
              <span>Status</span>
              <span>Endpoint</span>
              <span>Time</span>
              <span />
            </div>
            
            {logs.length === 0 && !loading && (
              <div className="p-10 text-center text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                No delivery logs found.
              </div>
            )}

            {logs.map((log) => (
              <div key={log.id} className="grid gap-4 border-b border-white/5 p-6 last:border-0 md:grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    {log.status === 0 ? (
                      <RefreshCw size={16} className="text-zinc-500 animate-spin" />
                    ) : log.status >= 200 && log.status < 300 ? (
                      <CheckCircle2 size={16} className="text-green-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                    <code className="text-xs font-bold text-white">{log.event}</code>
                  </div>
                  <p className="mt-2 text-[10px] font-mono text-zinc-600">
                    {log.id} · {log.latency}
                  </p>
                </div>
                
                <span className={`w-fit rounded-full border px-2 py-1 text-[9px] font-black ${
                  log.status === 0 ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-400" :
                  log.status >= 200 && log.status < 300 ? "border-green-500/20 bg-green-500/10 text-green-400" : 
                  "border-red-500/20 bg-red-500/10 text-red-400"
                }`}>
                  {log.status === 0 ? 'PENDING' : log.status}
                </span>
                
                <span className="truncate text-[10px] font-mono text-zinc-500">
                  {log.endpoint}
                </span>
                
                <span className="text-[10px] font-mono text-zinc-500">
                  {log.time}
                </span>
                
                {log.status >= 400 ? (
                  <button 
                    type="button" 
                    onClick={() => retry(log.id)} 
                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                ) : (
                  <span className="text-[9px] uppercase tracking-widest text-zinc-700">
                    {log.status === 0 ? 'Working' : 'Delivered'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
