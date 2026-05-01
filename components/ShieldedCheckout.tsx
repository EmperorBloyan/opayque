'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { useState } from 'react';
import { Connection } from '@solana/web3.js';

const TEE_RPC = 'https://devnet-tee.magicblock.app';

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
  productName = "Product",
}: {
  amount: number;
  merchantPubkey: string;
  productName?: string;
}) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!merchantPubkey) {
      alert("Merchant address is not configured.");
      return;
    }

    setLoading(true);

    try {
      // Build the shielded transaction using MagicBlock PER
      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        amount
      );

      // Sign and send to TEE RPC
      const signedTx = await signTransaction(tx);
      const connection = new Connection(TEE_RPC);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      alert(`✅ Shielded Payment Successful!\n\nAmount: ${amount} USDC\nTx Signature: ${signature.slice(0, 12)}...`);
      
      console.log("Shielded payment sent:", signature);
    } catch (error: any) {
      console.error("Shielded payment failed:", error);
      alert("Payment failed: " + (error.message || "Unknown error occurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={!connected || loading}
      className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-semibold py-5 px-8 rounded-2xl text-lg transition-all duration-300 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        "Processing Private Payment..."
      ) : (
        `Pay ${amount} USDC — Shielded & Private`
      )}
    </button>
  );
}