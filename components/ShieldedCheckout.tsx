'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { useState } from 'react';
import { Connection } from '@solana/web3.js';

const TEE_RPC = 'https://devnet-tee.magicblock.app';
const USDC_DECIMALS = 6;

function readStoredHistory() {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem('opayque_tx') || '[]');
  } catch {
    return [];
  }
}

function writeStoredHistory(items: Array<Record<string, unknown>>) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem('opayque_tx', JSON.stringify(items));
    window.dispatchEvent(new Event('storage'));
  } catch {
    // Ignore storage failures and keep the payment flow moving.
  }
}

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
}: {
  amount: number;
  merchantPubkey: string;
}) {
  const { publicKey, signTransaction, signAndSendTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'signing' | 'sending' | 'confirming'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayment = async () => {
    if (!publicKey) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Invalid payment amount.');
      return;
    }

    if (!signTransaction && !signAndSendTransaction) {
      setErrorMessage('Connected wallet cannot sign transactions.');
      return;
    }

    setLoading(true);
    setStatus('verifying');
    setErrorMessage(null);

    try {
      const teeConnection = new Connection(TEE_RPC, 'processed');
      const atomicAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        atomicAmount
      );

      let signature: string;

      if (signTransaction) {
        setStatus('signing');
        const signedTx = await signTransaction(tx);
        setStatus('sending');
        signature = await teeConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,
          maxRetries: 3,
        });
      } else if (signAndSendTransaction) {
        setStatus('sending');
        signature = await signAndSendTransaction(tx);
      } else {
        throw new Error('Connected wallet cannot sign transactions.');
      }

      const initialTx = {
        id: signature,
        staff: merchantPubkey,
        amount,
        time: new Date().toISOString(),
        status: 'SHIELDED_PENDING',
      };

      const history = readStoredHistory();
      writeStoredHistory([initialTx, ...history]);

      setStatus('confirming');
      const latestBlockhash = await teeConnection.getLatestBlockhash();
      await teeConnection.confirmTransaction({
        signature,
        ...latestBlockhash,
      }, 'confirmed');

      const finalHistory = readStoredHistory();
      const updatedHistory = finalHistory.map((t: any) =>
        t.id === signature ? { ...t, status: 'SHIELDED_CONFIRMED' } : t
      );
      writeStoredHistory(updatedHistory);

      window.alert(`✅ Shielded Payment Sent!\nTx: ${signature.slice(0, 12)}...`);
    } catch (error: unknown) {
      console.error('TEE Payment Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'The TEE RPC timed out or rejected the transaction.');
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

          {errorMessage ? (
            <p className="text-sm text-red-500">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
