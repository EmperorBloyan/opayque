'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { waitForSignatureConfirmation } from '@/lib/solana/rpc';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';

const TEE_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
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
  allowCustomAmount = false,
}: {
  amount: number;
  merchantPubkey: string;
  allowCustomAmount?: boolean;
}) {
  const { publicKey, signTransaction, connected } = useWallet() as { publicKey: { toBase58(): string } | null; signTransaction?: (tx: any) => Promise<any>; connected: boolean; };
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'signing' | 'sending' | 'confirming' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState<string>(() =>
    Number.isFinite(amount) && amount > 0 ? String(amount) : ''
  );
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);

  const parsedDraftAmount = Number.parseFloat(String(draftAmount).trim());
  const displayAmount = allowCustomAmount
    ? (Number.isFinite(parsedDraftAmount) && parsedDraftAmount > 0 ? parsedDraftAmount : 0)
    : amount;

  useEffect(() => {
    if (!allowCustomAmount) {
      setDraftAmount(Number.isFinite(amount) && amount > 0 ? String(amount) : '');
    }
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tx = params.get('tx_id');
        if (tx) setPendingTxId(tx);
      }
    } catch {}
  }, [allowCustomAmount, amount]);

  const handlePayment = async () => {
    if (!publicKey) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }

    const parsedAmount = Number.parseFloat(String(draftAmount).trim());
    const effectiveAmount = allowCustomAmount ? parsedAmount : amount;

    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      setErrorMessage('Invalid payment amount.');
      return;
    }

    if (!signTransaction) {
      setErrorMessage('Connected wallet cannot sign transactions.');
      return;
    }

    setLoading(true);
    setStatus('verifying');
    setErrorMessage(null);

    try {
      const teeConnection = new Connection(TEE_RPC, 'processed');
      const atomicAmount = Math.floor(effectiveAmount * 1_000_000);

      const tx = await buildShieldedTransfer(
        publicKey.toBase58(),
        merchantPubkey,
        atomicAmount
      );

      setStatus('signing');
      const signedTx = await signTransaction(tx);
      setStatus('sending');
      const signature = await teeConnection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      const initialTx = {
        id: signature,
        staff: merchantPubkey,
        amount: effectiveAmount,
        time: new Date().toISOString(),
        status: 'SHIELDED_PENDING',
      };

      const history = readStoredHistory();
      writeStoredHistory([initialTx, ...history]);

      setStatus('confirming');
      await waitForSignatureConfirmation(teeConnection, signature);

      // If we have a pending tx id upstream, mark it settled in Supabase
      try {
        if (pendingTxId) {
          const supabase = createSupabaseBrowserClient();
          await supabase.from('transactions').update({ status: 'settled', tx_hash: signature }).eq('id', pendingTxId);
        }
      } catch (err) {
        console.warn('Failed to update upstream transaction status', err);
      }

      const finalHistory = readStoredHistory();
      const updatedHistory = finalHistory.map((t: any) =>
        t.id === signature ? { ...t, status: 'SHIELDED_CONFIRMED' } : t
      );
      writeStoredHistory(updatedHistory);

      setStatus('success');
      window.alert(`✅ Shielded Payment Sent!\nTx: ${signature.slice(0, 12)}...`);
    } catch (error: unknown) {
      console.error('TEE Payment Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'The TEE RPC timed out or rejected the transaction.');
      setStatus('idle');
    } finally {
      setLoading(false);
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

          {allowCustomAmount ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-100 p-4 text-left dark:border-zinc-800 dark:bg-zinc-900/70">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Amount (USDC)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draftAmount}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDraftAmount(raw);
                }}
                className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-black text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                placeholder="Enter amount"
              />
            </div>
          ) : null}

          {!connected ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400">Connect your Solana wallet to continue.</p>
              <div className="mt-4 flex justify-center">
                <WalletMultiButton className="!bg-zinc-900 !text-white !rounded-xl !font-semibold !text-sm !px-4 !py-3" />
              </div>
            </div>
          ) : null}

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
            ) : status === 'success' ? (
              'Success!'
            ) : (
              `Pay ${allowCustomAmount ? (displayAmount > 0 ? displayAmount : '0.00') : amount} USDC (Shielded)`
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
