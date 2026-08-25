"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check } from "lucide-react";

import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter, CoinbaseWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssetMintAddress, isDevnetNetwork } from "@/lib/solana/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  id: string;
  amount: number;
  amount_fiat?: number;
  amount_token?: number;
  settlement_token?: string;
  currency: string;
  customer_email?: string | null;
  solana_pay_url?: string | null;
}

export default function CheckoutClient({ id, amount, amount_fiat, amount_token, settlement_token, currency, customer_email, solana_pay_url }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [merchantWallet, setMerchantWallet] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const { connection } = useConnection();
  const intervalRef = useRef<number | null>(null);

  // Wallet adapters
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl((process.env.NEXT_PUBLIC_SOLANA_NETWORK as any) || "devnet");
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter()], []);

  const normalizedFiatAmount = Number(amount_fiat ?? amount ?? 0);
  const normalizedUsdcEquivalent = Number(amount_token ?? amount ?? 0);
  const displayCurrency = (settlement_token || currency || "USDC").toUpperCase();
  const displayFiatCurrency = (currency || "USD").toUpperCase();

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/checkout/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const currentStatus = String(data.status || "pending").toLowerCase();
        setStatus(currentStatus);
        if (typeof data.merchantWallet === "string") setMerchantWallet(data.merchantWallet);
        if (data.transaction?.signature) setTransactionSignature(data.transaction.signature);
        if (currentStatus === "completed" || currentStatus === "paid") {
          setSuccess(true);
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    poll();
    intervalRef.current = window.setInterval(poll, 2000);
    return () => { mounted = false; if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [id]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function WrappedProviders({ children }: { children: React.ReactNode }) {
    return (
      <ConnectionProvider endpoint={rpcUrl}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    );
  }

  return (
    <WrappedProviders>
      <div className="min-h-[60vh] max-w-xl mx-auto p-6 rounded-2xl bg-[#0b0c10] border border-white/5 shadow-lg">
        {!success ? (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-extrabold text-white">
              {normalizedFiatAmount > 0 ? `Pay ${displayFiatCurrency} ${normalizedFiatAmount.toFixed(2)}` : `Pay ${displayCurrency} ${normalizedUsdcEquivalent.toFixed(2)}`}
            </h2>
            {normalizedUsdcEquivalent > 0 && (
              <p className="text-sm text-zinc-400">USDC equivalent: {normalizedUsdcEquivalent.toFixed(2)} {displayCurrency}</p>
            )}
            {customer_email && <p className="text-sm text-zinc-400">Buyer&apos;s email: {customer_email}</p>}

            <div className="flex flex-col items-center gap-4">
              {solana_pay_url ? (
                <div className="bg-black/60 p-4 rounded-xl">
                  <QRCodeCanvas value={solana_pay_url} size={220} fgColor="#a78bfa" />
                </div>
              ) : (
                <div className="h-[220px] w-[220px] rounded-xl bg-black/40 flex items-center justify-center text-zinc-500">No QR available</div>
              )}

              <div className="flex items-center gap-4">
                <WalletMultiButton />
                <PayButton
                  id={id}
                  amount={amount}
                  currency={currency}
                  merchantWallet={merchantWallet}
                  settlementAmount={normalizedUsdcEquivalent}
                  disabled={payLoading}
                  status={status}
                  success={success}
                  setToast={setToast}
                  setTransactionSignature={setTransactionSignature}
                  setSuccess={setSuccess}
                />
              </div>

              <div className="text-xs text-zinc-500">Status: <span className="text-white">{status ?? 'pending'}</span></div>
              {status && ['completed', 'paid'].includes(status.toLowerCase()) && (
                <div className="text-xs text-emerald-400">Payment already completed</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="h-28 w-28 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <Check className="text-emerald-400" size={48} />
            </div>
            <h3 className="text-2xl font-extrabold text-emerald-300">Payment Successful</h3>
            <p className="text-sm text-zinc-400">Thank you — your transaction was confirmed.</p>
            {transactionSignature && (
              <p className="mt-2 text-xs text-zinc-300">Reference: <span className="font-mono text-white">{transactionSignature}</span></p>
            )}
          </div>
        )}

        {toast && (
          <div role="status" className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl">
              {toast}
            </div>
          </div>
        )}
      </div>
    </WrappedProviders>
  );
}

function PayButton({ id, merchantWallet, settlementAmount, disabled, status, success, setToast, setTransactionSignature, setSuccess }: any) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (success || (status && ['completed', 'paid'].includes(status.toLowerCase()))) {
      setToast('Payment already completed');
      setSuccess(true);
      return;
    }

    if (!publicKey || !merchantWallet) {
      setToast('Connect your wallet first');
      return;
    }
    if (!signTransaction) {
      setToast('This wallet does not support private transaction signing');
      return;
    }
    setLoading(true);
    try {
      // Fetch session + merchant wallet from server for authoritative data
      const res = await fetch(`/api/v1/checkout/${id}/status`);
      if (!res.ok) throw new Error('Failed to fetch session');
      const sess = await res.json();
      const merchantWalletAddress = sess.merchantWallet || sess.merchant?.settlement_wallet_address || sess.settlement_wallet_address || merchantWallet;
      if (!merchantWalletAddress) throw new Error('Merchant settlement wallet not configured');
      const transferRes = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: publicKey.toBase58(),
          recipient: merchantWalletAddress,
          amount: Number(settlementAmount),
          mint: getAssetMintAddress('USDC', isDevnetNetwork()),
          intent_id: id,
          memo: id,
        }),
      });
      const transfer = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok || transfer.mode !== 'private' || typeof transfer.transaction !== 'string') {
        throw new Error(transfer.error || 'Private payment transaction could not be built');
      }
      const transactionBytes = Uint8Array.from(atob(transfer.transaction), (character) => character.charCodeAt(0));
      let transaction: VersionedTransaction | Transaction;
      try {
        transaction = VersionedTransaction.deserialize(transactionBytes);
      } catch {
        transaction = Transaction.from(transactionBytes);
      }
      const latest = await connection.getLatestBlockhash('confirmed');
      if (transaction instanceof VersionedTransaction) {
        transaction.message.recentBlockhash = latest.blockhash;
      } else {
        transaction.recentBlockhash = latest.blockhash;
        transaction.feePayer = publicKey;
      }
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: 'confirmed', maxRetries: 0 });
      setTransactionSignature(signature);

      // Await confirmation
      await connection.confirmTransaction({ signature, ...latest }, 'confirmed');

      // POST to verify endpoint
      const verifyRes = await fetch('/api/v1/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id, transactionSignature: signature }) });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || 'Verification failed');

      setSuccess(true);
      setToast('Payment verified and processed');
    } catch (err: any) {
      console.error(err);
      setToast(err?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePay} disabled={disabled || loading} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold disabled:opacity-50">
      {loading ? 'Processing…' : 'Pay Now'}
    </button>
  );
}
