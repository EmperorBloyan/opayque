'use client';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { useState, useMemo } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '@/lib/idl/opayque.json';

const TEE_RPC = 'https://devnet-tee.magicblock.app';
const USDC_DECIMALS = 6;

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
}: {
  amount: number;
  merchantPubkey: string;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'signing' | 'sending' | 'confirming'>('idle');

  // Anchor Integration: Initialize Program to verify the merchant on-chain
  const program = useMemo(() => {
    if (!anchorWallet) return null;
    const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
    return new Program(IDL as any, provider);
  }, [connection, anchorWallet]);

  const handlePayment = async () => {
    if (!publicKey || !signTransaction) return alert("Please connect your wallet first.");
    if (amount <= 0) return alert("Invalid payment amount.");
    if (!program) return alert("Anchor program not initialized.");

    setLoading(true);
    setStatus('verifying');

    try {
      // 1. ANCHOR INTEGRATION: Verify merchant is registered in the on-chain Registry
      // This prevents sending shielded funds to unauthenticated addresses
      const merchantAccount = await program.account.endpoint.all([
        { memcmp: { offset: 40, bytes: merchantPubkey } } // Assuming address offset in IDL
      ]);

      if (merchantAccount.length === 0) {
        throw new Error("Merchant is not a registered Opayque endpoint.");
      }

      const teeConnection = new Connection(TEE_RPC, 'processed');
      setStatus('signing');
      
      // SCALE: Convert USDC to atomic units (6 decimals) for the TEE transfer
      const atomicAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        atomicAmount
      );

      const signedTx = await signTransaction(tx);
      setStatus('sending');
      
      const signature = await teeConnection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      // INITIAL LOG: Save as PENDING so it appears on the dashboard immediately
      const initialTx = {
        id: signature,
        staff: merchantPubkey,
        amount,
        time: new Date().toISOString(),
        status: 'SHIELDED_PENDING'
      };
      const history = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
      localStorage.setItem("opayque_tx", JSON.stringify([initialTx, ...history]));
      window.dispatchEvent(new Event('storage'));

      setStatus('confirming');
      const latestBlockhash = await teeConnection.getLatestBlockhash();
      await teeConnection.confirmTransaction({
        signature,
        ...latestBlockhash,
      }, 'confirmed');

      // FINAL UPDATE: Mark as CONFIRMED to trigger the "Ping" notification
      const finalHistory = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
      const updatedHistory = finalHistory.map((t: any) => 
        t.id === signature ? { ...t, status: 'SHIELDED_CONFIRMED' } : t
      );
      localStorage.setItem("opayque_tx", JSON.stringify(updatedHistory));
      
      // FLUSH/SYNC: Force a storage event so other tabs (like TerminalManager) react immediately
      window.dispatchEvent(new Event('storage'));

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
