"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { useState } from 'react';
import { Connection } from '@solana/web3.js';
import { LucideShieldCheck, LucideLoader2 } from "lucide-react";

const TEE_RPC = 'https://devnet-tee.magicblock.app';

interface ShieldedCheckoutProps {
  amount: number;
  recipientAddress: string;
  recipientName: string;
  recipientImage?: string;
}

export default function ShieldedCheckout({
  amount,
  recipientAddress,
  recipientName,
  recipientImage,
}: ShieldedCheckoutProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    setLoading(true);

    try {
      // 1. Build the shielded transaction via MagicBlock Ephemeral Rollups
      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        recipientAddress,
        amount
      );

      // 2. Sign and send to TEE (Trusted Execution Environment) RPC
      const signedTx = await signTransaction(tx);
      const connection = new Connection(TEE_RPC);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      console.log("Shielded settlement complete:", signature);
      alert(`✅ Settlement Successful for ${recipientName}`);
    } catch (error: any) {
      console.error("Shielded payment failed:", error);
      alert("Payment failed: " + (error.message || "Session Expired"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-md">
      {/* IDENTITY PREVIEW */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-zinc-800 border border-purple-500/30 overflow-hidden shrink-0">
          {recipientImage ? (
            <img src={recipientImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <LucideShieldCheck size={20} />
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Recipient</p>
          <h4 className="text-sm font-black text-white italic uppercase tracking-tighter">{recipientName}</h4>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={!connected || loading}
        className="group relative w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] overflow-hidden transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-30"
      >
        <span className="relative z-10 flex items-center justify-center gap-3">
          {loading ? (
            <>
              <LucideLoader2 className="animate-spin" size={16} />
              Shielding Transaction...
            </>
          ) : (
            `Settle ${amount} USDC`
          )}
        </span>
        
        {/* Subtle Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-zinc-600">
        <LucideShieldCheck size={12} />
        <span className="text-[8px] font-black uppercase tracking-[0.2em]">TEE-Verified Ephemeral Session</span>
      </div>
    </div>
  );
}