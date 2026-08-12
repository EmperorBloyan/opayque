"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { buildShieldedTransfer } from '@/lib/magicblock';
import { waitForSignatureConfirmation } from '@/lib/solana/rpc';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useState } from 'react';
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
    // ignore
  }
}

export default function ShieldedCheckout({
  amount,
  merchantPubkey,
  endpointName,
  endpointCategory,
  allowCustomAmount = false,
  recipientName,
}: {
  amount: number;
  merchantPubkey: string;
  endpointName?: string;
  endpointCategory?: string;
  allowCustomAmount?: boolean;
  recipientName?: string;
}) {
  const { publicKey, signTransaction, signAndSendTransaction, connected } = useWallet() as {
    publicKey: { toBase58(): string } | null;
    signTransaction?: (tx: any) => Promise<any>;
    signAndSendTransaction?: (tx: any) => Promise<any>;
    connected: boolean;
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'signing' | 'sending' | 'confirming' | 'complete'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successSignature, setSuccessSignature] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState(() => (Number.isFinite(amount) && amount > 0 ? amount : 10));

  useEffect(() => {
    if (!allowCustomAmount) {
      setDraftAmount(Number.isFinite(amount) && amount > 0 ? amount : 10);
    }
  }, [allowCustomAmount, amount]);

  const safeMerchantPubkey = useMemo(() => merchantPubkey?.trim() || '', [merchantPubkey]);
  const effectiveAmount = allowCustomAmount ? draftAmount : amount;
  const isAmountValid = Number.isFinite(effectiveAmount) && effectiveAmount > 0;
  const isReadyToPay = connected && !!safeMerchantPubkey && (Boolean(signTransaction) || Boolean(signAndSendTransaction)) && isAmountValid && !loading;

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'verifying':
        return 'Validating payment details...';
      case 'signing':
        return 'Waiting for wallet signature...';
      case 'sending':
        return 'Submitting shielded transaction...';
      case 'confirming':
        return 'Confirming transaction on-chain...';
      case 'complete':
        return 'Payment confirmed!';
      default:
        return 'Ready to pay';
    }
  }, [status]);

  const explorerUrl = successSignature ? `https://explorer.solana.com/tx/${successSignature}?cluster=devnet` : undefined;

  const handlePayment = async () => {
    if (!publicKey) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }

    if (!safeMerchantPubkey) {
      setErrorMessage('Recipient address is missing.');
      return;
    }

    if (!signTransaction && !signAndSendTransaction) {
      setErrorMessage('Your connected wallet cannot sign transactions. Please use Phantom or another supported wallet.');
      return;
    }

    if (!isAmountValid) {
      setErrorMessage('Please provide a valid payment amount.');
      return;
    }

    setLoading(true);
    setStatus('verifying');
    setErrorMessage(null);
    setSuccessMessage(null);
    setSuccessSignature(null);

    try {
      const teeConnection = new Connection(TEE_RPC, 'processed');
      const atomicAmount = Math.floor(effectiveAmount * Math.pow(10, USDC_DECIMALS));

      const tx = await buildShieldedTransfer(publicKey.toBase58(), safeMerchantPubkey, atomicAmount);

      setStatus('signing');
      let signature: string;

      if (signAndSendTransaction) {
        const res = await signAndSendTransaction(tx as any);
        signature = (res && (res as any).signature) || String(res);
      } else {
        const signedTx = await signTransaction(tx as any);
        if (!signedTx) throw new Error('Transaction signing failed.');
        setStatus('sending');
        signature = await teeConnection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true, maxRetries: 5 });
        if (!signature) throw new Error('Transaction submission failed.');
      }

      const initialTx = {
        id: signature,
        staff: endpointName || safeMerchantPubkey,
        category: endpointCategory || 'Registry',
        source_name: endpointName || safeMerchantPubkey,
        source_category: endpointCategory || 'Registry',
        amount: effectiveAmount,
        time: new Date().toISOString(),
        status: 'SHIELDED_PENDING',
      } as any;

      writeStoredHistory([initialTx, ...readStoredHistory()]);

      setStatus('confirming');
      await waitForSignatureConfirmation(teeConnection, signature);

      try {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const pendingTxId = params?.get('tx_id') || null;
        if (pendingTxId) {
          const supabase = createSupabaseBrowserClient();
          await supabase.from('transactions').update({ status: 'settled', tx_hash: signature }).eq('id', pendingTxId);
        }
      } catch (err) {
        console.warn('Failed to update upstream transaction status', err);
      }

      const finalHistory = readStoredHistory();
      const updatedHistory = finalHistory.map((t: any) => (t.id === signature ? { ...t, status: 'SHIELDED_CONFIRMED', source_name: endpointName || safeMerchantPubkey, source_category: endpointCategory || 'Registry' } : t));
      writeStoredHistory(updatedHistory);

      setStatus('complete');
      setSuccessSignature(signature);
      setSuccessMessage('Shielded payment confirmed and stored locally.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'The TEE RPC timed out or rejected the transaction.');
      setStatus('idle');
    } finally {
      setLoading(false);
      setStatus((current) => (current === 'complete' ? current : 'idle'));
    }
  };

  const handleClose = () => {
    if (typeof window === 'undefined') return;
    try {
      window.close();
    } catch {}

    setTimeout(() => {
      if (!window.closed) window.location.replace('https://phantom.app/');
    }, 120);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-50/95 dark:bg-black/95 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md p-8 bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col gap-6 text-center">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Shielded Checkout</h3>
            {recipientName ? <p className="text-zinc-500 text-sm mt-1">Paying {recipientName}</p> : <p className="text-zinc-500 text-sm mt-1">Protected via MagicBlock TEE</p>}
          </div>

          {allowCustomAmount ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-100 p-4 text-left dark:border-zinc-800 dark:bg-zinc-900/70">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Amount (USDC)</label>
              <input type="number" min="0.01" step="0.01" value={String(draftAmount)} onChange={(e) => setDraftAmount(Number(e.target.value))} className="mt-2 w-full rounded-md border px-3 py-2" />
            </div>
          ) : null}

          <div>
            <button disabled={!isReadyToPay} onClick={handlePayment} className="w-full rounded-2xl bg-purple-600 py-3 font-black text-white disabled:opacity-40">
              {statusLabel}
            </button>
          </div>

          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
          {successMessage ? (
            <div>
              <p className="text-sm text-emerald-500">{successMessage}</p>
              {explorerUrl ? (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-sm text-zinc-500 underline">
                  View on explorer
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
