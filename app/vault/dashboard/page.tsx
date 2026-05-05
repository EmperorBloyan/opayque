"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useMemo } from 'react';

const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function VaultDashboard() {
  const { publicKey, connected } = useWallet();
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [flushLoading, setFlushLoading] = useState(false);

  useEffect(() => {
    const savedTx = localStorage.getItem('opayque_tx');
    const savedBalance = localStorage.getItem('opayque_balance');
    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedBalance) setPrivateBalance(Number(savedBalance));
  }, []);

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

      // 2. Update Local State
      const updatedTx = [settleTx, ...transactions];
      setTransactions(updatedTx);
      setPrivateBalance(0);

      // 3. Persist
      localStorage.setItem('opayque_tx', JSON.stringify(updatedTx));
      localStorage.setItem('opayque_balance', '0');
      
      setFlushLoading(false);
    }, 2000);
  };

  const statusColor = (status: string) => {
    switch(status) {
      case 'Settled': return 'bg-green-500/10 text-green-500';
      case 'Pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'Failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-zinc-500/10 text-zinc-500';
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
        <h2 className="text-7xl font-mono font-bold tracking-tighter">{formatUSDC(privateBalance)}</h2>
        
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