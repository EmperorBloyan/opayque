"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';

// Format as Currency
const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function MerchantAdmin() {
  const { publicKey, connected } = useWallet();
  const [privateBalance, setPrivateBalance] = useState<number>(1250.50);
  const [flushLoading, setFlushLoading] = useState(false);
  const [pairingToken, setPairingToken] = useState("");
  
  // Persistence for Staff and Transactions
  const [staffList, setStaffList] = useState<{name: string, address: string}[]>([]);
  const [transactions, setTransactions] = useState<{id: string, staff: string, amount: number, time: string}[]>([]);

  useEffect(() => {
    const savedStaff = localStorage.getItem('opayque_staff');
    const savedTx = localStorage.getItem('opayque_tx');
    if (savedStaff) setStaffList(JSON.parse(savedStaff));
    if (savedTx) setTransactions(JSON.parse(savedTx));
  }, []);

  const generatePairingToken = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingToken(code);
    localStorage.setItem('active_pairing_code', code); // For Terminal Validation
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">Opayque</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Admin Command Center</p>
          </div>
          <WalletMultiButton className="!bg-white !text-black !rounded-full !font-bold !text-xs" />
        </header>

        {connected ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT: Financials & History */}
            <div className="lg:col-span-8 space-y-8">
              <div className="p-10 rounded-[3rem] bg-gradient-to-br from-zinc-900 to-black border border-white/10">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Total Shielded Volume</p>
                <h2 className="text-7xl font-mono font-bold tracking-tighter">{formatUSDC(privateBalance)}</h2>
                <button 
                  onClick={() => { setFlushLoading(true); setTimeout(() => { setPrivateBalance(0); setFlushLoading(false); }, 2000); }}
                  className="mt-8 px-8 py-4 bg-purple-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all"
                >
                  {flushLoading ? "Executing TEE Flush..." : "Execute Settlement"}
                </button>
              </div>

              {/* NEW: TRANSACTION HISTORY TABLE */}
              <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-6 px-2 text-zinc-400">Recent Terminal Activity</h3>
                <div className="overflow-hidden rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-zinc-600 uppercase text-[9px]">
                        <th className="pb-4 px-4 font-bold">ID</th>
                        <th className="pb-4 px-4 font-bold">Terminal/Staff</th>
                        <th className="pb-4 px-4 font-bold">Amount</th>
                        <th className="pb-4 px-4 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.length > 0 ? transactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 font-mono text-zinc-500">{tx.id}</td>
                          <td className="py-4 px-4 font-bold">{tx.staff}</td>
                          <td className="py-4 px-4 text-purple-400 font-bold">{formatUSDC(tx.amount)}</td>
                          <td className="py-4 px-4 text-right"><span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-full text-[8px] font-bold uppercase">Settled</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="py-12 text-center text-zinc-700 italic">No activity recorded for this epoch.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT: Management */}
            <div className="lg:col-span-4 space-y-8">
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem]">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-6">Device Pairing</h3>
                <div className="flex items-center justify-between bg-black p-6 rounded-2xl border border-white/5">
                  <span className="text-3xl font-mono font-black text-purple-500 tracking-tighter">{pairingToken || "------"}</span>
                  <button onClick={generatePairingToken} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">🔄</button>
                </div>
              </div>
              
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem]">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Endpoints</h3>
                <div className="space-y-4">
                  {staffList.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-zinc-800" />
                      <p className="text-[10px] font-bold truncate">{s.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-40 text-center opacity-20 uppercase font-bold tracking-[1em] text-xs">Awaiting Merchant Key</div>
        )}
      </div>
    </div>
  );
}
