"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { getPrivateBalance, buildWithdraw } from '@/lib/magicblock';
import { Connection } from '@solana/web3.js';

const TEE_RPC = 'https://devnet-tee.magicblock.app';

const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function MerchantAdmin() {
  const { publicKey, signTransaction, connected } = useWallet();
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

  // Real private balance fetch
  useEffect(() => {
    if (!publicKey) return;

    const fetchBalance = async () => {
      const bal = await getPrivateBalance(publicKey.toBase58());
      setPrivateBalance(bal);
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 4000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const generatePairingToken = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingToken(code);
    localStorage.setItem('active_pairing_code', code);
  };

  const handleFlush = async () => {
    if (!publicKey || privateBalance <= 0) return;
    setFlushLoading(true);
    try {
      const tx = await buildWithdraw(publicKey.toBase58(), publicKey.toBase58(), privateBalance); // Using same address for demo
      const signedTx = await signTransaction!(tx);
      const connection = new Connection(TEE_RPC);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      alert(`Flush Successful! Tx: ${sig.slice(0,12)}...`);
      setPrivateBalance(0);
    } catch (e: any) {
      alert("Flush failed: " + e.message);
    }
    setFlushLoading(false);
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
            {/* Your original LEFT & RIGHT panels stay the same */}
            <div className="lg:col-span-8 space-y-8">
              <div className="p-10 rounded-[3rem] bg-gradient-to-br from-zinc-900 to-black border border-white/10">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Total Shielded Volume</p>
                <h2 className="text-7xl font-mono font-bold tracking-tighter">{formatUSDC(privateBalance)}</h2>
                <button 
                  onClick={handleFlush}
                  disabled={flushLoading}
                  className="mt-8 px-8 py-4 bg-purple-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all"
                >
                  {flushLoading ? "Executing TEE Flush..." : "Execute Settlement"}
                </button>
              </div>

              {/* Transaction History stays as you had it */}
              <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-6 px-2 text-zinc-400">Recent Terminal Activity</h3>
                {/* ... your table ... */}
              </div>
            </div>

            {/* Right side panels stay as you designed */}
            <div className="lg:col-span-4 space-y-8">
              {/* Device Pairing & Endpoints panels unchanged */}
            </div>
          </div>
        ) : (
          <div className="py-40 text-center opacity-20 uppercase font-bold tracking-[1em] text-xs">Awaiting Merchant Key</div>
        )}
      </div>
    </div>
  );
}
