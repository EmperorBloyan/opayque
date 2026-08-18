"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrency } from '@/lib/context/CurrencyContext';
import { Search, RotateCcw, Copy, Check, AlertTriangle, X } from 'lucide-react';

const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function VaultDashboard() {
  const { publicKey, connected } = useWallet();
  const { currency, setCurrency, rates, convert } = useCurrency();
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [flushLoading, setFlushLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Refund Modal State
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<any | null>(null);
  const [refundInput, setRefundInput] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Copy Feedback State
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

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

  // Load from local storage and listen for cross-tab or component updates
  useEffect(() => {
    const reloadFromStorage = () => {
      try {
        const savedTx = localStorage.getItem("opayque_tx");
        if (!savedTx) return;
        const parsed = JSON.parse(savedTx);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore
      }
    };

    // Initial load
    reloadFromStorage();

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "opayque_tx") reloadFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("opayque_tx_updated", reloadFromStorage as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("opayque_tx_updated", reloadFromStorage as EventListener);
    };
  }, []);

  // Live refresh when registry/terminal payments write local activity
  useEffect(() => {
    const hydrateFromLocal = () => {
      try {
        const raw = window.localStorage.getItem("opayque_tx");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore
      }
    };

    const onCustom = () => hydrateFromLocal();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "opayque_tx") hydrateFromLocal();
    };

    window.addEventListener("opayque_tx_updated", onCustom as EventListener);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", hydrateFromLocal);

    return () => {
      window.removeEventListener("opayque_tx_updated", onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", hydrateFromLocal);
    };
  }, []);

  useEffect(() => {
    const resolvedBalance = transactions.reduce((sum, tx) => {
      const amount = Number(tx.amount ?? 0);
      const status = String(tx.status ?? '').toUpperCase();
      if (!Number.isFinite(amount)) {
        return sum;
      }
      if (
        ["SETTLED", "SHIELDED", "SHIELDED_CONFIRMED", "CONFIRMED", "SUCCESS"].includes(status)
      ) {
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

  const handleSettlement = () => {
    if (privateBalance <= 0) return;
    setFlushLoading(true);

    setTimeout(() => {
      const settleTx = {
        id: `SETTLE-${Math.random().toString(36).toUpperCase().slice(0, 6)}`,
        staff: "System (L1 Flush)",
        amount: -privateBalance,
        status: "Settled",
        time: new Date().toISOString()
      };

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

  const handleCopyTxId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedTxId(id);
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  const handleExecuteRefund = async () => {
    if (!selectedTxForRefund) return;
    if (refundInput.trim().toUpperCase() !== 'REFUND') {
      setRefundError('Please type "REFUND" to confirm.');
      return;
    }

    setRefundLoading(true);
    setRefundError(null);

    try {
      const targetTx = selectedTxForRefund;

      // 1. Attempt optional API call if endpoint exists
      try {
        await fetch('/api/v1/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: targetTx.id,
            amount: targetTx.amount,
          }),
        });
      } catch (e) {
        console.warn('Backend refund endpoint offline; executing locally and via Supabase.', e);
      }

      // 2. Sync status to Supabase if accessible
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase
          .from('transactions')
          .update({ status: 'REFUNDED' })
          .eq('id', targetTx.id);
      } catch (e) {
        console.warn('Supabase refund update skipped.', e);
      }

      // 3. Create negative audit entry and update original state
      const refundAuditRecord = {
        id: `REFUND-${Math.random().toString(36).toUpperCase().slice(0, 6)}`,
        staff: `Refund (${targetTx.id.slice(0, 8)})`,
        category: 'Refund',
        amount: -Math.abs(targetTx.amount),
        status: 'REFUNDED',
        time: new Date().toISOString(),
      };

      persistTransactions((current) => {
        const updated = current.map((tx) =>
          tx.id === targetTx.id ? { ...tx, status: 'REFUNDED' } : tx
        );
        return [refundAuditRecord, ...updated].slice(0, 20);
      });

      // Cleanup
      setSelectedTxForRefund(null);
      setRefundInput("");
    } catch (err: any) {
      setRefundError(err?.message || 'Failed to complete refund operation.');
    } finally {
      setRefundLoading(false);
    }
  };

  const statusColor = (status: string) => {
    const normalized = String(status ?? '').toUpperCase();
    switch(normalized) {
      case 'SETTLED':
      case 'SHIELDED_CONFIRMED':
      case 'CONFIRMED':
        return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'FAILED':
      case 'REFUNDED':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20';
    }
  };

  // Filter transactions based on Tx ID or Endpoint search
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const query = searchQuery.toLowerCase().trim();
    return transactions.filter(
      (tx) =>
        String(tx.id ?? '').toLowerCase().includes(query) ||
        String(tx.staff ?? '').toLowerCase().includes(query) ||
        String(tx.category ?? '').toLowerCase().includes(query) ||
        String(tx.status ?? '').toLowerCase().includes(query) ||
        String(tx.amount ?? '').includes(query)
    );
  }, [transactions, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Vault Balance Banner */}
      <div className="p-10 rounded-[3rem] bg-zinc-900 border border-white/10 relative overflow-hidden">
         {publicKey && (
           <div className="absolute top-6 right-10 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
             Vault ID: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
           </div>
         )}

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-6">
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Private Shielded Volume</p>
            <h2 className="text-7xl font-mono font-bold tracking-tighter text-white">{convert(privateBalance).formatted}</h2>
          </div>
          <div>
            <label className="block text-[9px] text-zinc-400 mb-2 font-medium uppercase tracking-widest">Display Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
            >
              {Object.keys(rates).length > 0 ? (
                Object.keys(rates).map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))
              ) : (
                <option value="USD">USD</option>
              )}
            </select>
          </div>
        </div>
        
        <button 
          onClick={handleSettlement}
          disabled={privateBalance <= 0 || flushLoading || !connected}
          className="px-8 py-4 bg-purple-600 disabled:opacity-20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
        >
          {flushLoading ? "TEE Settlement in Progress..." : "Execute L1 Settlement"}
        </button>
      </div>

      {/* Activity Table Card */}
      <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 px-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Activity</h3>
          
          {/* TX ID Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Tx ID, endpoint..."
              className="w-full rounded-full border border-white/10 bg-zinc-950/80 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 outline-none transition focus:border-purple-500/50"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-zinc-600 uppercase text-[9px]">
                <th className="pb-4 px-4 font-bold">TX ID</th>
                <th className="pb-4 px-4 font-bold">Endpoint</th>
                <th className="pb-4 px-4 font-bold">Amount</th>
                <th className="pb-4 px-4 font-bold text-center">Status</th>
                <th className="pb-4 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx, i) => {
                  const isSettled = ['SETTLED', 'SHIELDED', 'SHIELDED_CONFIRMED', 'CONFIRMED', 'SUCCESS'].includes(
                    String(tx.status ?? '').toUpperCase()
                  );
                  const isPositive = Number(tx.amount) > 0;

                  return (
                    <tr key={tx.id || i} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-4 font-mono text-zinc-400 group-hover:text-purple-400 transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{tx.id}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyTxId(tx.id, e)}
                            className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy Tx ID"
                          >
                            {copiedTxId === tx.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-white">{tx.staff || tx.category || "—"}</td>
                      <td className={`py-4 px-4 font-bold font-mono ${tx.amount < 0 ? 'text-zinc-500' : 'text-purple-400'}`}>
                        {convert(tx.amount).formatted}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider ${statusColor(tx.status || 'Settled')}`}>
                          {tx.status || 'Settled'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isSettled && isPositive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTxForRefund(tx);
                              setRefundInput("");
                              setRefundError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40 text-[9px] font-bold uppercase tracking-wider transition active:scale-95"
                          >
                            <RotateCcw size={10} /> Refund
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-600 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-zinc-600 italic">
                    {searchQuery ? "No matching transactions found." : "No merchant activity detected."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Confirmation Refund Modal */}
      {selectedTxForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[2.5rem] border border-rose-500/20 bg-zinc-950 p-8 shadow-[0_25px_120px_rgba(239,68,68,0.2)] space-y-6 relative">
            <button
              type="button"
              onClick={() => setSelectedTxForRefund(null)}
              className="absolute top-6 right-6 p-2 rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-400">Irreversible Action</p>
                <h3 className="text-xl font-black text-white">Confirm Refund</h3>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/60 p-4 space-y-3 font-mono text-xs text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase">Target Tx ID:</span>
                <span className="text-white font-bold">{selectedTxForRefund.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase">Endpoint:</span>
                <span className="text-white">{selectedTxForRefund.staff || selectedTxForRefund.category || "—"}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-zinc-500 uppercase">Refund Amount:</span>
                <span className="text-rose-400 font-bold text-sm">{convert(selectedTxForRefund.amount).formatted}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Type <span className="text-rose-400 font-mono">REFUND</span> to confirm:
              </label>
              <input
                type="text"
                value={refundInput}
                onChange={(e) => setRefundInput(e.target.value)}
                placeholder="REFUND"
                className="w-full rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none transition focus:border-rose-500"
              />
              {refundError && (
                <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} /> {refundError}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTxForRefund(null)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={refundLoading || refundInput.trim().toUpperCase() !== 'REFUND'}
                className="flex-1 rounded-2xl bg-rose-600 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {refundLoading ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}