'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Zap, ShieldCheck, Sparkles, Terminal, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import OpayqueCheckout from '@/components/OpayqueCheckout';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

interface ConsoleLog {
  timestamp: string;
  type: 'info' | 'success' | 'warn';
  message: string;
}

export default function SandboxPage() {
  const router = useRouter();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  
  // Real Database State
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [apiKey, setApiKey] = useState('');
  const [merchantWallet, setMerchantWallet] = useState('');

  // Live Terminal Logs
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp: time, type, message }, ...prev]);
  };

  const fetchLatestSandboxSession = async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();

    if (!supabase) {
      addLog('Supabase is not configured for this environment. Sandbox data is unavailable.', 'warn');
      setIsLoading(false);
      return;
    }

    try {
      addLog('Fetching sandbox details from Supabase...', 'info');

      // 1. Fetch latest active checkout session in test/sandbox environment
      const { data: session, error: sessionErr } = await supabase
        .from('checkout_sessions')
        .select('id, amount, merchant_id, environment, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionErr) throw sessionErr;

      if (session) {
        setOrderId(session.id);
        setAmount(Number(session.amount));
        addLog(`Found checkout session: ${session.id}`, 'info');

        // 2. Fetch Merchant Wallet from 'merchants' table
        if (session.merchant_id) {
          const { data: merchant } = await supabase
            .from('merchants')
            .select('settlement_wallet_address')
            .eq('id', session.merchant_id)
            .single();

          if (merchant?.settlement_wallet_address) {
            setMerchantWallet(merchant.settlement_wallet_address);
            addLog(`Loaded settlement wallet: ${merchant.settlement_wallet_address.slice(0, 6)}...`, 'info');
          }
        }
      } else {
        addLog('No active checkout session found in DB. Ready to create one.', 'warn');
      }

      // 3. Fetch API key from 'developer_projects'
      const { data: devProject } = await supabase
        .from('developer_projects')
        .select('public_api_key')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (devProject?.public_api_key) {
        setApiKey(devProject.public_api_key);
        addLog('Loaded public API key.', 'info');
      }

    } catch (err: any) {
      addLog(`Supabase fetch error: ${err.message || err}`, 'warn');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSandboxSession();
  }, []);

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      addLog('Copied Sandbox API Key to clipboard.', 'info');
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white font-mono overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.08),transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-5xl rounded-[3rem] border border-white/10 bg-zinc-950/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          
          <button
            type="button"
            onClick={() => router.push('/developer/overview')}
            className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={14} className="mr-2 inline-block" /> Close
          </button>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            
            {/* LEFT PANEL */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Sparkles size={14} /> Devnet Simulation
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
                  Sandbox Checkout
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400 font-sans">
                  Connected live to Supabase. Validate transactions using real merchant addresses and session records.
                </p>
              </div>

              {isLoading ? (
                <div className="flex h-48 items-center justify-center rounded-[2rem] border border-white/10 bg-black/40">
                  <Loader2 className="animate-spin text-purple-500" size={28} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Checkout Session ID</p>
                        <button 
                          onClick={fetchLatestSandboxSession} 
                          className="text-zinc-500 hover:text-purple-400 transition-colors"
                          title="Refresh DB Session"
                        >
                          <RefreshCw size={12} />
                        </button>
                      </div>
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.05em] text-purple-300 truncate">
                        {orderId || 'No Active Session'}
                      </p>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Amount</p>
                      <p className="mt-2 text-sm font-black uppercase tracking-[0.1em] text-emerald-400">
                        {amount > 0 ? `${amount.toFixed(2)} USDC` : '0.00 USDC'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Public API Key</p>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900 px-3 py-2">
                        <span className="text-[11px] text-zinc-300 truncate max-w-[120px]">
                          {apiKey || 'No Key Configured'}
                        </span>
                        {apiKey && (
                          <button onClick={handleCopyKey} className="text-zinc-400 hover:text-white">
                            {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500">Settlement Wallet</p>
                      <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-zinc-300 truncate">
                        {merchantWallet || 'Not Configured'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  disabled={isLoading || !merchantWallet}
                  className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-purple-500/20 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap size={16} /> Launch Checkout
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/developer/overview')}
                  className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
                >
                  <ShieldCheck size={16} /> Dashboard
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: LIVE EVENT TERMINAL */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/80 p-6 shadow-inner min-h-[380px]">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5 text-purple-400">
                    <Terminal size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">Live Event Log</span>
                  </div>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="mt-4 space-y-2.5 max-h-[280px] overflow-y-auto pr-2 text-[11px] font-mono leading-relaxed">
                  {logs.length === 0 ? (
                    <p className="text-zinc-600 italic">Listening for sandbox actions...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 border-b border-white/5 pb-1.5">
                        <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                        <span className={
                          log.type === 'success' ? 'text-emerald-400' :
                          log.type === 'warn' ? 'text-amber-400' : 'text-purple-200'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/5 bg-zinc-950 p-3 text-[10px] text-zinc-500 flex justify-between items-center">
                <span>Database: <strong className="text-purple-400">Supabase Connected</strong></span>
                <span>Status: <strong className="text-emerald-400">Live</strong></span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <OpayqueCheckout
          apiKey={apiKey}
          orderId={orderId}
          amountUsdc={amount}
          merchantWallet={merchantWallet}
          onSuccess={async (hash: string) => {
            addLog(`Tx Confirmed on Solana! Hash: ${hash}`, 'success');

            // Optionally record signature directly into 'onchain_transactions'
            const supabase = getSupabaseClient();
            if (orderId && supabase) {
              await supabase.from('onchain_transactions').insert({
                checkout_session_id: orderId,
                signature: hash,
                amount: amount,
                status: 'COMPLETED'
              });
              addLog('Saved transaction to onchain_transactions table.', 'success');
            }

            setIsCheckoutOpen(false);
          }}
          onClose={() => {
            addLog('Checkout modal dismissed by user.', 'warn');
            setIsCheckoutOpen(false);
          }}
        />
      )}
    </main>
  );
}
