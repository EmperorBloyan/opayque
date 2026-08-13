"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveSession } from '@/lib/crypto/session';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function VaultDashboard() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const activeSession = getActiveSession();
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [terminalLabels, setTerminalLabels] = useState<Record<string, string>>({});
  const [flushLoading, setFlushLoading] = useState(false);

  useEffect(() => {
    if (!activeSession) {
      router.replace('/login');
    }
  }, [activeSession, router]);

  const persistTransactions = (nextTransactions: any[] | ((current: any[]) => any[])) => {
    setTransactions((current) => {
      const resolved = typeof nextTransactions === 'function' ? nextTransactions(current) : nextTransactions;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('opayque_tx', JSON.stringify(resolved));
        }
      } catch {
        // ignore storage errors
      }
      return resolved;
    });
  };

  useEffect(() => {
    const savedTx = localStorage.getItem('opayque_tx');
    if (savedTx) {
      try {
        const parsed = JSON.parse(savedTx);
        setTransactions(parsed);
      } catch {
        // ignore invalid storage data
      }
    }
  }, []);

  useEffect(() => {
    const resolvedBalance = transactions.reduce((sum, tx) => {
      const amount = Number(tx.amount ?? 0);
      const status = String(tx.status ?? '').toUpperCase();
      if (!Number.isFinite(amount)) {
        return sum;
      }
      if (['SETTLED', 'SHIELDED_CONFIRMED', 'CONFIRMED'].includes(status)) {
        return sum + amount;
      }
      return sum;
    }, 0);
    setPrivateBalance(resolvedBalance);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('opayque_balance', String(resolvedBalance));
      }
    } catch {
      // ignore storage errors
    }
  }, [transactions]);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();

      const seedTransactions = async () => {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && Array.isArray(data)) {
          const mapped = data.map((row: any) => ({
            id: String(row.id ?? row.tx_hash ?? row.signature ?? 'pending'),
            staff: row.source_name ?? (row.terminal_id ? 'Merchant Terminal' : 'System'),
            category: row.source_category ?? (row.terminal_id ? 'Terminal' : 'Registry'),
            amount: Number(row.amount ?? 0),
            status: String(row.status ?? 'Pending'),
            time: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            terminalId: row.terminal_id ?? null,
          }));

          persistTransactions((current) => {
            const merged = [...mapped, ...current.filter((tx) => !mapped.some((next) => next.id === tx.id))];
            return merged.slice(0, 20);
          });
        }
      };

      void seedTransactions();

      const channel = supabase
        .channel('vault-dashboard-transactions')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'transactions' },
          (payload) => {
            const row = payload.new as any;
            if (!row) return;
            const nextRow = {
              id: String(row.id ?? row.tx_hash ?? row.signature ?? 'pending'),
              staff: row.source_name ?? (row.terminal_id ? 'Merchant Terminal' : 'System'),
              category: row.source_category ?? (row.terminal_id ? 'Terminal' : 'Registry'),
              amount: Number(row.amount ?? 0),
              status: String(row.status ?? 'Pending'),
              time: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              terminalId: row.terminal_id ?? null,
            };
            persistTransactions((current) => [nextRow, ...current].slice(0, 20));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'transactions' },
          (payload) => {
            const row = payload.new as any;
            if (!row) return;
            const nextRow = {
              id: String(row.id ?? row.tx_hash ?? row.signature ?? 'pending'),
              staff: row.source_name ?? (row.terminal_id ? 'Merchant Terminal' : 'System'),
              category: row.source_category ?? (row.terminal_id ? 'Terminal' : 'Registry'),
              amount: Number(row.amount ?? 0),
              status: String(row.status ?? 'Pending'),
              time: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              terminalId: row.terminal_id ?? null,
            };
            persistTransactions((current) => {
              const existingIndex = current.findIndex((tx: any) => tx.id === nextRow.id);
              if (existingIndex >= 0) {
                const updated = [...current];
                updated[existingIndex] = nextRow;
                return updated.slice(0, 20);
              }
              return [nextRow, ...current].slice(0, 20);
            });
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.warn('Vault dashboard Supabase sync failed', error);
    }
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'opayque_tx' || !event.newValue) {
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          persistTransactions((current) => {
            const merged = [...parsed, ...current.filter((tx) => !parsed.some((next) => next.id === tx.id))];
            return merged.slice(0, 20);
          });
        }
      } catch {
        // ignore invalid storage event payload
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!activeSession) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/90 p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-zinc-500">Session locked</p>
          <h1 className="mt-4 text-3xl font-black text-white">Vault dashboard is locked</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            You must unlock the developer hub before viewing the vault. Redirecting to login...
          </p>
        </div>
      </main>
    );
  }

  const handleSettlement = () => {
    if (privateBalance <= 0) return;
    setFlushLoading(true);

    setTimeout(() => {
      // 1. Create the Settlement Transaction Row
      const settleTx = {
        id: `SETTLE-${Math.random().toString(36).toUpperCase().slice(0, 6)}`,
        staff: "System (L1 Flush)",
        amount: -privateBalance, // Negative to show outflow
        status: "Settled",
        time: new Date().toISOString()
      };

      // 2. Update Local State and persist
      persistTransactions((current) => [settleTx, ...current].slice(0, 20));
      setPrivateBalance(0);

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('opayque_balance', '0');
        }
      } catch {
        // ignore storage errors
      }
      
      setFlushLoading(false);
    }, 2000);
  };

  const statusColor = (status: string) => {
    const normalized = String(status ?? '').toUpperCase();
    switch(normalized) {
      case 'SETTLED':
      case 'SHIELDED_CONFIRMED':
      case 'CONFIRMED':
        return 'bg-green-500/10 text-green-500';
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'FAILED':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-zinc-500/10 text-zinc-500';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="p-10 rounded-[3rem] bg-zinc-900 border border-white/10 relative overflow-hidden">
         {/* Subtle Wallet Identifier */}
         {publicKey && (
           <div className="absolute top-6 right-10 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
             Vault ID: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
           </div>
         )}

        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Private Shielded Volume</p>
        <h2 className="text-7xl font-mono font-bold tracking-tighter text-white">{formatUSDC(privateBalance)}</h2>
        
        <button 
          onClick={handleSettlement}
          disabled={privateBalance <= 0 || flushLoading || !connected}
          className="mt-8 px-8 py-4 bg-purple-600 disabled:opacity-20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
        >
          {flushLoading ? "TEE Settlement in Progress..." : "Execute L1 Settlement"}
        </button>
      </div>

      <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
        <h3 className="text-xs font-bold uppercase tracking-widest mb-6 px-2 text-zinc-400">Recent Activity</h3>
        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-zinc-600 uppercase text-[9px]">
                <th className="pb-4 px-4 font-bold">TX ID</th>
                <th className="pb-4 px-4 font-bold">Endpoint</th>
                <th className="pb-4 px-4 font-bold">Amount</th>
                <th className="pb-4 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.length > 0 ? transactions.map((tx, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-4 font-mono text-zinc-500 group-hover:text-purple-400 transition-colors">{tx.id}</td>
                  <td className="py-4 px-4 font-bold">{tx.staff}</td>
                  <td className={`py-4 px-4 font-bold ${tx.amount < 0 ? 'text-zinc-500' : 'text-purple-400'}`}>
                    {formatUSDC(tx.amount)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-tighter ${statusColor(tx.status || 'Settled')}`}>
                      {tx.status || 'Settled'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-20 text-center text-zinc-700 italic">No merchant activity detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}