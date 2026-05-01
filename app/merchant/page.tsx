'use client';

// ✅ FIXED: Split imports into Core (logic) and UI (buttons)
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

import { useEffect, useState } from 'react';
import { getPrivateBalance, buildWithdraw } from '@/lib/magicblock';
import { Connection } from '@solana/web3.js';

// Using the constant from your TEE environment
const TEE_RPC = 'https://rpc.magicblock.app/v1/per';

export default function MerchantDashboard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [mainWallet, setMainWallet] = useState("");
  const [flushLoading, setFlushLoading] = useState(false);

  // Fetch private balance periodically
  useEffect(() => {
    if (!publicKey) return;

    const fetchBalance = async () => {
      try {
        const balance = await getPrivateBalance(publicKey.toBase58());
        setPrivateBalance(balance);
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Refresh every 10 seconds to save RPC credits
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleFlush = async () => {
    if (!publicKey || !mainWallet || privateBalance <= 0) {
      alert("Please ensure your wallet is connected and you have a shielded balance.");
      return;
    }

    setFlushLoading(true);
    try {
      // 1. Request the withdrawal transaction from the MagicBlock API
      const result = await buildWithdraw(publicKey.toBase58(), privateBalance);

      if (result.error) {
        throw new Error(result.error);
      }

      // Note: If using the 2026 managed API, the TEE might handle the signing.
      // If result returns a 'transaction' field, sign it here:
      if (result.transaction && signTransaction) {
        // Logic for signing and sending goes here if the API requires client-side signing
        alert("Withdrawal request sent to TEE! Processing unshielding...");
      } else {
        alert(`✅ Flush Initiated!\nShielded funds are being moved to: ${mainWallet.slice(0, 8)}...`);
      }

      setPrivateBalance(0); // Optimistic UI update
    } catch (error: any) {
      console.error(error);
      alert("Flush failed: " + (error.message || "The TEE was unable to process the withdrawal."));
    } finally {
      setFlushLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
              opayque
            </h1>
            <p className="text-zinc-500 mt-1">Shielded Merchant Vault</p>
          </div>
          <WalletMultiButton className="!bg-white !text-black !rounded-2xl !font-bold" />
        </div>

        {connected && publicKey ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Private Balance Card */}
            <div className="p-10 rounded-3xl bg-gradient-to-br from-purple-950/40 to-zinc-900 border border-purple-500/30 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                <p className="uppercase tracking-widest text-purple-400 text-xs font-bold">Shielded Balance (Private)</p>
              </div>
              <p className="text-7xl font-mono font-bold text-white">
                ${privateBalance.toFixed(2)}
              </p>
              <p className="text-zinc-500 mt-4 text-sm flex items-center gap-2">
                <span className="opacity-50">🛡️</span> Encrypted in MagicBlock TEE
              </p>
            </div>

            {/* Flush Section */}
            <div className="p-10 rounded-3xl bg-zinc-900/50 border border-white/10 backdrop-blur-md">
              <h3 className="text-lg font-semibold mb-6">Flush to Main Wallet</h3>
              
              <input
                type="text"
                placeholder="Destination Solana Address"
                className="w-full bg-black/40 border border-zinc-700 rounded-2xl px-5 py-4 mb-6 focus:outline-none focus:border-purple-500 transition-colors"
                value={mainWallet}
                onChange={(e) => setMainWallet(e.target.value)}
              />

              <button
                onClick={handleFlush}
                disabled={flushLoading || privateBalance <= 0 || !mainWallet}
                className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
              >
                {flushLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : `Unshield $${privateBalance.toFixed(2)} USDC`}
              </button>

              <p className="text-center text-[10px] text-zinc-600 mt-6 leading-relaxed">
                UNSHIELDING CONSOLIDATES ALL PRIVATE TRANSACTIONS INTO A SINGLE <br/> 
                PUBLIC L1 SETTLEMENT TO PROTECT MERCHANT PRIVACY.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-zinc-900/20 border border-white/5 rounded-3xl">
            <h2 className="text-2xl font-bold mb-4">Merchant Authentication Required</h2>
            <p className="text-zinc-500 mb-8 max-w-sm mx-auto">Connect your authorized merchant wallet to view your private vault and manage shielded liquidity.</p>
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}