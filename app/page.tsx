"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState, useMemo, useCallback } from "react";

// --- UTILS ---
const formatUSDC = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

type Staff = { id: string; name: string; type: string };
type Tx = { id: string; staff: string; amount: number; time: string };

// Toggle demo helpers with env var: set NEXT_PUBLIC_DEMO_MODE=true for recordings
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function MerchantAdmin() {
  // 1. HYDRATION & WALLET STATE
  const [mounted, setMounted] = useState(false);
  const { publicKey, connected } = useWallet();

  // 2. APP STATE (lazy init from localStorage)
  const [privateBalance, setPrivateBalance] = useState<number>(() => {
    try {
      const v = localStorage.getItem("opayque_balance");
      return v ? Number(v) : 1250.5;
    } catch {
      return 1250.5;
    }
  });
  const [flushLoading, setFlushLoading] = useState(false);
  const [pairingToken, setPairingToken] = useState<string>(() => {
    try {
      return localStorage.getItem("active_pairing_code") || "";
    } catch {
      return "";
    }
  });
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("opayque_staff") || "[]");
    } catch {
      return [];
    }
  });
  const [transactions, setTransactions] = useState<Tx[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("opayque_tx") || "[]");
    } catch {
      return [];
    }
  });

  // Toast state (non-blocking)
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // 3. MOUNT LOGIC
  useEffect(() => {
    setMounted(true);
  }, []);

  // 4. Persist changes reactively
  useEffect(() => {
    try {
      localStorage.setItem("opayque_staff", JSON.stringify(staffList));
    } catch {}
  }, [staffList]);

  useEffect(() => {
    try {
      localStorage.setItem("opayque_tx", JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem("active_pairing_code", pairingToken || "");
    } catch {}
  }, [pairingToken]);

  useEffect(() => {
    try {
      localStorage.setItem("opayque_balance", String(privateBalance));
    } catch {}
  }, [privateBalance]);

  // 5. ACTIONS (secure token + stable tx ids)
  const generatePairingToken = useCallback(() => {
    // secure 6-digit token
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = String(100000 + (arr[0] % 900000));
    setPairingToken(code);
    setToast("Pairing code generated.");
  }, []);

  const addTransaction = useCallback((staff: string, amount: number) => {
    const tx: Tx = { id: crypto.randomUUID(), staff, amount, time: new Date().toISOString() };
    setTransactions((p) => [tx, ...p]);
  }, []);

  const handleFlush = useCallback(() => {
    setFlushLoading(true);
    // simulate async settlement
    setTimeout(() => {
      setPrivateBalance(0);
      setFlushLoading(false);
      setToast("TEE Privacy Shield: Funds flushed to Layer 1 Mainnet.");
    }, 2500);
  }, []);

  // 6. Demo transaction simulation (keyboard + optional button)
  useEffect(() => {
    if (!DEMO) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") {
        addTransaction("Terminal 01", 25.0);
        setPrivateBalance((prev) => Number((prev + 25.0).toFixed(2)));
        setToast("New Shielded Payment: $25.00 received.");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addTransaction]);

  // 7. Derived values
  const formattedBalance = useMemo(() => formatUSDC(privateBalance), [privateBalance]);
  const shortPub = useMemo(() => (publicKey ? `${publicKey.toBase58().slice(0, 4)}...` : null), [publicKey]);

  // Prevent Hydration Mismatch
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <header className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">Opayque</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">
              {connected ? `Vault Active: ${shortPub}` : "Vault Offline"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Optional demo simulate button */}
            {DEMO && (
              <button
                onClick={() => {
                  addTransaction("Terminal 01", 25.0);
                  setPrivateBalance((prev) => Number((prev + 25.0).toFixed(2)));
                  setToast("New Shielded Payment: $25.00 received.");
                }}
                className="px-3 py-2 text-xs bg-white/5 rounded hover:bg-white/10 transition"
                aria-label="Simulate transaction (T)"
              >
                Simulate TX (T)
              </button>
            )}

            <WalletMultiButton
              className="!bg-white !text-black !rounded-full !font-bold !text-xs hover:!bg-zinc-200 transition-all"
              aria-label="Connect wallet"
            />
          </div>
        </header>

        {connected ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
            {/* LEFT: FINANCIALS & HISTORY */}
            <div className="lg:col-span-8 space-y-8">
              <div className="p-10 rounded-[3.5rem] bg-zinc-900 border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-6xl font-black italic group-hover:scale-110 transition-transform">
                  VAULT
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">
                  Private Shielded Volume
                </p>
                <h2 className="text-7xl font-mono font-bold tracking-tighter">{formattedBalance}</h2>
                <button
                  onClick={handleFlush}
                  disabled={flushLoading || privateBalance === 0}
                  aria-label="Execute L1 Settlement"
                  className="mt-8 px-10 py-4 bg-purple-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all disabled:opacity-20"
                >
                  {flushLoading ? "TEE Settlement in Progress..." : "Execute L1 Settlement"}
                </button>
              </div>

              {/* AUDIT LEDGER */}
              <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Activity</h3>
                  <span className="text-[9px] text-zinc-600 font-mono">Real-time sync</span>
                </div>
                <div className="overflow-hidden rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-zinc-600 uppercase text-[9px]">
                        <th className="pb-4 px-4 font-bold">TX ID</th>
                        <th className="pb-4 px-4 font-bold">Terminal</th>
                        <th className="pb-4 px-4 font-bold">Amount</th>
                        <th className="pb-4 px-4 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.length > 0 ? (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                            <td
                              className="py-5 px-4 font-mono text-purple-500/50 blur-[2px] hover:blur-none focus:blur-none transition-all cursor-help"
                              tabIndex={0}
                              title="Encrypted transaction ID"
                            >
                              {tx.id.slice(0, 12)}...
                            </td>
                            <td className="py-5 px-4 font-bold">{tx.staff}</td>
                            <td className="py-5 px-4 text-purple-400 font-bold">{formatUSDC(tx.amount)}</td>
                            <td className="py-5 px-4 text-right">
                              <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[8px] font-bold uppercase tracking-tighter">
                                Settled
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-20 text-center text-zinc-700 italic font-medium">
                            No merchant activity detected in this epoch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT: DEVICE MANAGEMENT */}
            <div className="lg:col-span-4 space-y-8">
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem] shadow-2xl">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-6 text-zinc-400">Terminal Pairing</h3>
                <p className="text-[10px] text-zinc-600 mb-4 leading-relaxed">
                  Enter this code on any Opayque Hardware terminal to authorize spending endpoints.
                </p>
                <div className="flex items-center justify-between bg-black p-6 rounded-2xl border border-white/5 mb-4 group">
                  <span className="text-4xl font-mono font-black text-purple-500 tracking-tighter">
                    {pairingToken || "------"}
                  </span>
                  <button
                    onClick={generatePairingToken}
                    aria-label="Generate pairing code"
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all group-active:rotate-180 duration-500"
                  >
                    🔄
                  </button>
                </div>
              </div>

              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Authorized Staff</h3>
                  <button
                    className="text-[9px] font-bold uppercase text-purple-500 hover:underline"
                    aria-label="Add staff"
                    onClick={() =>
                      setStaffList((p) => [
                        ...p,
                        { id: crypto.randomUUID(), name: `Staff ${p.length + 1}`, type: "POS" },
                      ])
                    }
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-4">
                  {staffList.length > 0 ? (
                    staffList.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-zinc-800 border border-white/5 flex items-center justify-center text-lg">
                          👤
                        </div>
                        <div>
                          <p className="text-[11px] font-bold tracking-tight">{s.name}</p>
                          <p className="text-[8px] text-zinc-500 uppercase font-black">{s.type}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic text-center py-4">No staff endpoints registered.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-40 flex flex-col items-center justify-center animate-pulse">
            <div className="w-20 h-20 bg-zinc-900 rounded-full mb-8 border border-white/5 flex items-center justify-center">
              <span className="text-2xl grayscale opacity-50">🛡️</span>
            </div>
            <p className="uppercase font-black tracking-[0.6em] text-zinc-700 text-[10px]">Awaiting Merchant Authorization</p>
          </div>
        )}
      </div>

      {/* Toast */}
      <div aria-live="polite" className="fixed bottom-6 right-6">
        {toast && (
          <div className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-lg text-sm shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
