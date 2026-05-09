"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { getPrivateBalance, buildWithdraw } from '@/lib/magicblock';
import { Connection } from '@solana/web3.js';

const TEE_RPC = 'https://devnet-tee.magicblock.app';

export default function MerchantDashboard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [privateBalance, setPrivateBalance] = useState(0);
  const [mainWallet, setMainWallet] = useState("");
  const [flushLoading, setFlushLoading] = useState(false);
  const [showVault, setShowVault] = useState(false);

  // Reduced timeout for vault entrance (1.2 seconds)
  useEffect(() => {
    if (publicKey) {
      const timer = setTimeout(() => setShowVault(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey || !showVault) return;

    const fetchBalance = async () => {
      const bal = await getPrivateBalance(publicKey.toBase58());
      setPrivateBalance(bal);
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 4000);
    return () => clearInterval(interval);
  }, [publicKey, showVault]);

  const handleFlush = async () => {
    if (!publicKey || !mainWallet || privateBalance <= 0) return;

    setFlushLoading(true);
    try {
      const tx = await buildWithdraw(publicKey.toBase58(), mainWallet, privateBalance);
      const signedTx = await signTransaction!(tx);
      const connection = new Connection(TEE_RPC);
      const sig = await connection.sendRawTransaction(signedTx.serialize());

      alert(`✅ Flush Successful!\nTx: ${sig.slice(0,12)}...`);
      setPrivateBalance(0);
    } catch (e: any) {
      alert("Flush failed: " + e.message);
    }
    setFlushLoading(false);
  };

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <WalletMultiButton />
          <p className="mt-6 text-zinc-500">Connect Merchant Wallet</p>
        </div>
      </div>
    );
  }

  if (!showVault) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-purple-500 text-2xl mb-4">🔐</div>
          <p className="text-white text-xl">Awaiting Merchant Authorization...</p>
          <p className="text-zinc-500 text-sm mt-2">TEE Validation in progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Your original merchant dashboard design goes here */}
      {/* We kept it minimal so your original styling remains intact */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">OPAYQUE VAULT</h1>
          <WalletMultiButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-zinc-900 p-10 rounded-3xl">
            <p className="text-purple-400 uppercase text-xs tracking-widest mb-4">Shielded Balance</p>
            <p className="text-6xl font-mono font-bold">${privateBalance.toFixed(2)}</p>
            <p className="text-zinc-500 mt-2">USDC • Private</p>
          </div>

          <div className="bg-zinc-900 p-10 rounded-3xl">
            <h3 className="mb-6 text-lg">Flush to Main Wallet</h3>
            <input
              type="text"
              placeholder="Main Solana Address"
              className="w-full bg-black border border-zinc-700 rounded-2xl px-5 py-4 mb-6"
              value={mainWallet}
              onChange={(e) => setMainWallet(e.target.value)}
            />
            <button
              onClick={handleFlush}
              disabled={flushLoading || privateBalance <= 0 || !mainWallet}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold"
            >
              {flushLoading ? "Flushing..." : "Execute Flush"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
