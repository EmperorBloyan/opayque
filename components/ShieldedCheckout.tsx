'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { useState } from 'react';
import { Connection } from '@solana/web3.js';

const TEE_RPC = 'https://devnet-tee.magicblock.app';

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
}: {
  amount: number;
  merchantPubkey: string;
}) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'signing' | 'sending' | 'confirming'>('idle');

  const handlePayment = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    setLoading(true);
    setStatus('signing');

    try {
      const connection = new Connection(TEE_RPC, 'confirmed');
      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        amount
      );

      const signedTx = await signTransaction(tx);
      setStatus('sending');
      
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      setStatus('confirming');
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      }, 'confirmed');

      alert(`✅ Shielded Payment Sent!\nTx: ${signature.slice(0, 12)}...`);
    } catch (error: any) {
      console.error("TEE Payment Error:", error);
      alert("Payment failed: " + (error.message || "The TEE RPC timed out or rejected the transaction."));
    } finally {
      setLoading(false);
      setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-50/95 dark:bg-black/95 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md p-8 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col gap-6 text-center">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Shielded Checkout</h3>
            <p className="text-zinc-500 text-sm mt-1">Secured via MagicBlock TEE</p>
          </div>

          <button
            onClick={handlePayment}
            disabled={!connected || loading}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-4 rounded-2xl text-lg transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-green-500/20"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="capitalize">{status}...</span>
              </div>
            ) : (
              `Pay ${amount} USDC (Shielded)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
