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

  const handlePayment = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    setLoading(true);

    try {
      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        amount
      );

      const signedTx = await signTransaction(tx);
      const connection = new Connection(TEE_RPC);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      alert(`✅ Shielded Payment Sent!\nTx: ${signature.slice(0, 12)}...`);
    } catch (error: any) {
      alert("Payment failed: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    // Keep your original button design - only logic fixed
    <button
      onClick={handlePayment}
      disabled={!connected || loading}
      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-4 rounded-2xl text-lg disabled:opacity-50"
    >
      {loading ? "Processing Shielded Payment..." : `Pay ${amount} USDC (Shielded)`}
    </button>
  );
}
