"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuthenticatedMerchantId } from '@/lib/auth/authenticatedMerchant';
import { useCurrency } from '@/lib/context/CurrencyContext';
import { Search, RotateCcw, Copy, Check, AlertTriangle, X, ChevronDown } from 'lucide-react';

const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const currencySymbols: Record<string, string> = {
  USD: "$",
  USDC: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  INR: "₹",
  CAD: "C$",
  AUD: "A$",
};

export default function VaultDashboard() {
  const { publicKey, connected } = useWallet();
  const { currency, setCurrency, rates, convert } = useCurrency();
  const [volumeView, setVolumeView] = useState<"private" | "standard" | "total">("private");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [flushLoading, setFlushLoading] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);
  const [flushError, setFlushError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  // Refund Modal State
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<any | null>(null);
  const [refundInput, setRefundInput] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundWallet, setRefundWallet] = useState<string | null>(null);
  const [merchantReady, setMerchantReady] = useState(false);

  // Copy Feedback State
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const persistTransactions = (nextTransactions: any[] | ((current: any[]) => any[])) => {
    setTransactions((current) => {
      const resolved = typeof nextTransactions === 'function' ? nextTransactions(current) : nextTransactions;
      return resolved;
    });
  };

  const isSuccessfulPayment = (status: unknown) =>
    ["SETTLED", "SHIELDED", "SHIELDED_CONFIRMED", "CONFIRMED", "SUCCESS"].includes(
      String(status ?? "").toUpperCase()
    );

  const getVolume = (mode: "private" | "standard" | "total") =>
    transactions.reduce((sum, tx) => {
      const amount = Number(tx.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0 || !isSuccessfulPayment(tx.status)) return sum;
      const transferMode = tx.transferMode === "public" ? "standard" : "private";
      return mode === "total" || transferMode === mode ? sum + amount : sum;
    }, 0);

  // Keep the settlement action tied to the private shielded balance.
  useEffect(() => {
    const resolvedBalance = getVolume("private");
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('opayque_balance', String(resolvedBalance));
      }
    } catch {
      // ignore storage errors
    }
  }, [transactions]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    try {
      const seedTransactions = async (merchantId: string) => {
        const allRows: any[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const response = await fetch(`/api/merchant/activity?page=${page}&pageSize=100`, { credentials: 'include', cache: 'no-store' });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !Array.isArray(payload.data)) break;
          allRows.push(...payload.data);
          hasMore = payload.hasMore === true;
          page += 1;
        }
        const data = allRows;

        if (Array.isArray(data)) {
          const mapped = data.map((row: any) => ({
            id: String(row.id ?? row.tx_hash ?? row.signature ?? 'pending'),
            staff: row.source_name ?? (row.terminal_id ? 'Merchant Terminal' : 'System'),
            category: row.source_category ?? (row.terminal_id ? 'Terminal' : 'Registry'),
            amount: Number(row.amount ?? 0),
            status: String(row.status ?? 'Pending'),
            time: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            terminalId: row.terminal_id ?? null,
            transferMode: row.transfer_mode === "public" ? "public" : "private",
          }));

          persistTransactions((current) => {
            const merged = [...mapped, ...current.filter((tx) => !mapped.some((next) => next.id === tx.id))];
            return merged;
          });
        }
      };

      let channel: any = null;
      void (async () => {
        const merchantId = await getAuthenticatedMerchantId();
        if (!merchantId) {
          setMerchantReady(false);
          setTransactions([]);
          return;
        }
        setMerchantReady(true);

        const { data: merchant } = await supabase
          .from("merchants")
          .select("refund_wallet_address, settlement_wallet_address, wallet_address")
          .eq("id", merchantId)
          .maybeSingle();
        // Refund signer resolution: dedicated refund wallet, settlement wallet, then connected vault authority.
        setRefundWallet(
          merchant?.refund_wallet_address ||
          merchant?.settlement_wallet_address ||
          merchant?.wallet_address ||
          publicKey?.toBase58() ||
          null
        );

        await seedTransactions(merchantId);
        channel = supabase
          .channel(`vault-dashboard-transactions-${merchantId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'payment_ledger', filter: `merchant_id=eq.${merchantId}` },
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
              transferMode: row.transfer_mode === "public" ? "public" : "private",
            };
            persistTransactions((current) => [nextRow, ...current]);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'payment_ledger', filter: `merchant_id=eq.${merchantId}` },
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
              transferMode: row.transfer_mode === "public" ? "public" : "private",
            };
            persistTransactions((current) => {
              const existingIndex = current.findIndex((tx: any) => tx.id === nextRow.id);
              if (existingIndex >= 0) {
                const updated = [...current];
                updated[existingIndex] = nextRow;
                return updated;
              }
              return [nextRow, ...current];
            });
          }
        )
          .subscribe();
      })();

      return () => {
        if (channel) void supabase.removeChannel(channel);
      };
    } catch (error) {
      console.warn('Vault dashboard Supabase sync failed', error);
    }
  }, []);

  const handleSettlement = async () => {
    const privateBalance = getVolume("private");
    if (privateBalance <= 0) return;
    setFlushLoading(true);
    setFlushMessage(null);
    setFlushError(null);

    try {
      const merchantId = await getAuthenticatedMerchantId();
      if (!merchantId) throw new Error("Authenticated merchant not found");

      const supabase = createSupabaseBrowserClient();
      const settlement = {
        merchant_id: merchantId,
        amount: privateBalance,
        currency: "USDC",
        status: "completed",
        payout_id: `demo-l1-settlement-${Date.now()}`,
      };

      const { data, error } = await supabase
        .from("settlements")
        .insert(settlement)
        .select()
        .single();

      if (error || !data) throw new Error(error?.message || "Failed to record demo settlement");

      persistTransactions((current) => [{
        id: String(data.id),
        staff: "System (DEMO L1 Settlement)",
        category: "Settlement",
        amount: -Number(data.amount),
        status: String(data.status),
        time: data.created_at,
        terminalId: null,
      }, ...current]);
      setFlushMessage("Demo L1 settlement recorded successfully.");
    } catch (error) {
      console.error("Demo L1 settlement failed", error);
      setFlushError(error instanceof Error ? error.message : "Demo L1 settlement failed");
    } finally {
      setFlushLoading(false);
    }
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
      const merchantId = await getAuthenticatedMerchantId();
      if (!merchantId) throw new Error("Authenticated merchant not found");
      const sourceWallet = refundWallet;
      if (!sourceWallet) throw new Error("Configure a refund wallet before issuing refunds.");

      // Refund funds must be executed by the refund backend using this payout-out signer.
      // This UI does not initialize or move a merchant vault for refunds.
      const refundResponse = await fetch('/api/v1/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: targetTx.id,
          amount: targetTx.amount,
          refundWalletAddress: sourceWallet,
        }),
      });
      if (!refundResponse.ok) {
        const body = await refundResponse.json().catch(() => ({}));
        throw new Error(body?.error || 'Refund execution service is unavailable.');
      }

      // 2. Sync status to Supabase if accessible
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase
          .from('payment_ledger')
          .update({ status: 'REFUNDED' })
          .eq('merchant_id', merchantId)
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
    const query = searchQuery.toLowerCase().trim();
    return transactions.filter(
      (tx) =>
        (statusFilter === "ALL" || String(tx.status ?? "").toUpperCase() === statusFilter) &&
        (!query ||
          String(tx.id ?? '').toLowerCase().includes(query) ||
          String(tx.staff ?? '').toLowerCase().includes(query) ||
          String(tx.category ?? '').toLowerCase().includes(query) ||
          String(tx.status ?? '').toLowerCase().includes(query) ||
          String(tx.amount ?? '').includes(query))
    );
  }, [transactions, searchQuery, statusFilter]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(
      transactions
        .map((tx) => String(tx.status ?? "").trim().toUpperCase())
        .filter(Boolean)
    );
    return Array.from(statuses).sort();
  }, [transactions]);

  useEffect(() => {
    if (!showStatusMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowStatusMenu(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showStatusMenu]);

  const volumeLabels = {
    private: "Private Shielded Volume",
    standard: "Standard Payment Volume",
    total: "Total Volume",
  } as const;
  const displayedVolume = getVolume(volumeView);
  const privateBalance = getVolume("private");
  const cycleVolumeView = () => {
    setVolumeView((current) => current === "private" ? "standard" : current === "standard" ? "total" : "private");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 animate-in fade-in duration-700">
      {/* Vault Balance Banner */}
      <div
        className="block w-full p-10 rounded-[3rem] bg-zinc-900 border border-white/10 relative overflow-hidden text-left"
      >
         {publicKey && (
           <div className="absolute top-6 right-10 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
             Vault ID: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
           </div>
         )}

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-6">
          <div>
            <button
              type="button"
              onClick={cycleVolumeView}
              aria-label={`Show ${volumeView === "private" ? "standard payment" : volumeView === "standard" ? "total" : "private shielded"} volume`}
              className="mb-2 block rounded-md text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              {volumeLabels[volumeView]}
            </button>
            <h2 className="text-7xl font-mono font-bold tracking-tighter text-white">{convert(displayedVolume).formatted}</h2>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 sm:min-w-40">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Currency</span>
            <span className="relative inline-flex items-center gap-1 text-sm font-semibold text-white">
              <span aria-hidden="true">{currencySymbols[currency] ?? currency}</span>
              <ChevronDown size={13} aria-hidden="true" className="text-zinc-500" />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Select currency"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {Object.keys(rates).length > 0 ? (
                  Object.keys(rates).map((curr) => <option key={curr} value={curr}>{curr}</option>)
                ) : (
                  <option value="USD">USD</option>
                )}
              </select>
            </span>
          </div>
        </div>
        
        {volumeView === "private" && (
          <>
            <button
              onClick={handleSettlement}
              disabled={privateBalance <= 0 || flushLoading || !merchantReady}
              className="px-8 py-4 bg-purple-600 disabled:opacity-20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
            >
              {flushLoading ? "Saving Demo Settlement..." : "Execute Demo L1 Settlement"}
            </button>
            {flushMessage && <p className="mt-3 text-xs font-bold text-emerald-300">{flushMessage}</p>}
            {flushError && <p className="mt-3 text-xs font-bold text-red-300">{flushError}</p>}
          </>
        )}
      </div>

      {/* Activity Table Card */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3rem] border border-white/5 bg-zinc-900/40 p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 px-2">
          <div className="relative" ref={statusMenuRef}>
            <button
              type="button"
              aria-expanded={showStatusMenu}
              aria-haspopup="menu"
              onClick={() => setShowStatusMenu((current) => !current)}
              className="group flex items-center gap-3 rounded-2xl px-2 py-1 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <span>
                <span className="block text-xs font-bold uppercase tracking-widest text-zinc-300">Recent Activity</span>
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-purple-400/80">
                  {statusFilter === "ALL" ? "All statuses" : statusFilter.replaceAll("_", " ")}
                </span>
              </span>
              <ChevronDown size={15} className={`text-zinc-500 transition-transform ${showStatusMenu ? "rotate-180 text-purple-400" : "group-hover:text-zinc-300"}`} />
            </button>

            {showStatusMenu && (
              <div
                role="menu"
                aria-label="Filter recent activity by status"
                className="absolute left-0 top-full z-20 mt-3 min-w-52 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
              >
                {["ALL", ...statusOptions].map((status) => {
                  const selected = statusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowStatusMenu(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${selected ? "bg-purple-500/15 text-purple-300" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
                    >
                      <span>{status === "ALL" ? "All statuses" : status.replaceAll("_", " ")}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.9)]" : "bg-zinc-700"}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* TX ID Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activity, transaction, endpoint..."
              aria-label="Search recent activity"
              className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-600 outline-none transition hover:border-white/20 focus:border-purple-400/60 focus:bg-black/45"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl">
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
                    {searchQuery || statusFilter !== "ALL" ? "No matching transactions found." : "No merchant activity detected."}
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