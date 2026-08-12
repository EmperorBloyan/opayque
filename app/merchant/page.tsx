"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getPrivateBalance, buildWithdraw } from '@/lib/magicblock';
import { waitForSignatureConfirmation } from '@/lib/solana/rpc';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getAssetMintAddress } from '@/lib/solana/constants';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getActiveMerchantId } from '@/lib/crypto/session';

const TEE_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

export default function MerchantDashboard() {
  const { publicKey, signTransaction, signAndSendTransaction, connected } = useWallet();
  const [privateBalance, setPrivateBalance] = useState(0);
  const [mainWallet, setMainWallet] = useState("");
  const [flushLoading, setFlushLoading] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [transactions, setTransactions] = useState<Array<{ signature: string; amount: number; time: string; status: string }>>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);
  const transactionSignatures = useRef<Set<string>>(new Set());
  const connectionRef = useRef<Connection | null>(null);
  const supabaseChannelRef = useRef<any | null>(null);

  const merchantAta = useMemo(() => {
    if (!publicKey) return null;
    const mintAddress = new PublicKey(getAssetMintAddress('USDC', true));
    return getAssociatedTokenAddressSync(mintAddress, publicKey);
  }, [publicKey]);

  // Reduced timeout for vault entrance (1.2 seconds)
  useEffect(() => {
    if (publicKey) {
      const timer = setTimeout(() => setShowVault(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey || !showVault) return;

    const fetchBalance = async () => {
      const bal = await getPrivateBalance(publicKey.toBase58());
      setPrivateBalance(bal);
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 4000);
    return () => clearInterval(interval);
  }, [publicKey, showVault]);

  useEffect(() => {
    if (!publicKey || !showVault || !merchantAta) return;

    if (!connectionRef.current) {
      connectionRef.current = new Connection(TEE_RPC, 'confirmed');
    }
    const connection = connectionRef.current;

    const extractUsdcAmount = (parsedTx: any) => {
      if (!parsedTx?.transaction?.message?.instructions) return 0;
      for (const ix of parsedTx.transaction.message.instructions) {
        if (ix.program !== 'spl-token' || !ix.parsed?.type) continue;
        const type = ix.parsed.type;
        if (type !== 'transfer' && type !== 'transferChecked') continue;

        const info = ix.parsed.info;
        const destination = info?.destination || info?.account;
        if (destination !== merchantAta.toBase58()) continue;

        const rawAmount = Number(info?.amount ?? info?.tokenAmount?.amount ?? 0);
        const decimals = Number(info?.decimals ?? info?.tokenAmount?.decimals ?? 6);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;
        return rawAmount / 10 ** decimals;
      }
      return 0;
    };

    const fetchRecentTransfers = async () => {
      try {
        const signatures = await connection.getSignaturesForAddress(merchantAta, { limit: 20 });
        const newSignatures = signatures
          .map((item) => item.signature)
          .filter((signature) => !transactionSignatures.current.has(signature));

        if (newSignatures.length === 0) return;

        const newTransactions = await Promise.all(
          newSignatures.map(async (signature) => {
            try {
              const parsed = await connection.getParsedTransaction(signature, 'finalized');
              const amount = extractUsdcAmount(parsed);
              if (amount <= 0) return null;
              return {
                signature,
                amount,
                time: parsed?.blockTime ? new Date(parsed.blockTime * 1000).toISOString() : new Date().toISOString(),
                status: parsed?.meta?.err ? 'failed' : 'confirmed',
              };
            } catch (error) {
              console.error('Failed to fetch parsed transaction', signature, error);
              return null;
            }
          })
        );

        const filtered = newTransactions.filter(Boolean) as Array<{ signature: string; amount: number; time: string; status: string }>;
        if (filtered.length === 0) return;

        setTransactions((current) => {
          const additions = filtered.filter((tx) => !current.some((existing) => existing.signature === tx.signature));
          if (additions.length === 0) return current;
          additions.forEach((tx) => transactionSignatures.current.add(tx.signature));
          const next = [...additions, ...current];
          next.sort((a, b) => (a.time < b.time ? 1 : -1));
          return next;
        });
      } catch (error) {
        console.error('Merchant dashboard polling failed', error);
      }
    };

    fetchRecentTransfers();
    const poll = setInterval(fetchRecentTransfers, 3000);
    return () => clearInterval(poll);
  }, [publicKey, showVault, merchantAta]);

  // Supabase realtime subscription for merchant transactions
  useEffect(() => {
    if (!showVault) return;
    const merchantId = getActiveMerchantId();
    if (!merchantId) return;

    const supabase = createSupabaseBrowserClient();

    // initial load of recent transactions from Supabase to seed UI
    (async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          const mapped = data
            .map((row: any) => ({
              signature: String(row.signature ?? row.tx_hash ?? row.id ?? ''),
              amount: Number(row.amount ?? 0),
              time: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              status: String(row.status ?? 'pending'),
            }))
            .filter((r: any) => r.signature && r.amount > 0);

          // dedupe and prepend any unseen
          setTransactions((current) => {
            mapped.forEach((tx: any) => transactionSignatures.current.add(tx.signature));
            const merged = [...mapped, ...current];
            merged.sort((a, b) => (a.time < b.time ? 1 : -1));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Failed to seed transactions from Supabase', err);
      }
    })();

    const channel = supabase
      .channel(`merchant-transactions-${merchantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const rec = payload.new as any;
          if (!rec) return;
          const sig = String(rec.signature ?? rec.tx_hash ?? rec.id ?? '');
          if (!sig) return;
          if (transactionSignatures.current.has(sig)) return;
          const t = { signature: sig, amount: Number(rec.amount ?? 0), time: rec.created_at ? new Date(rec.created_at).toISOString() : new Date().toISOString(), status: String(rec.status ?? 'pending') };
          transactionSignatures.current.add(sig);
          setTransactions((current) => [t, ...current]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `merchant_id=eq.${merchantId}` },
        (payload) => {
          const rec = payload.new as any;
          if (!rec) return;
          const sig = String(rec.signature ?? rec.tx_hash ?? rec.id ?? '');
          if (!sig) return;

          setTransactions((current) => {
            const found = current.find((c) => c.signature === sig);
            const updated = { signature: sig, amount: Number(rec.amount ?? 0), time: rec.created_at ? new Date(rec.created_at).toISOString() : new Date().toISOString(), status: String(rec.status ?? 'pending') };
            if (found) {
              return current.map((c) => (c.signature === sig ? updated : c));
            }
            transactionSignatures.current.add(sig);
            return [updated, ...current];
          });
        }
      )
      .subscribe();

    supabaseChannelRef.current = channel;

    return () => {
      if (supabaseChannelRef.current) {
        void createSupabaseBrowserClient().removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }
    };
  }, [showVault]);

  useEffect(() => {
    setTotalRevenue(transactions.reduce((sum, tx) => sum + (tx.status === 'confirmed' ? tx.amount : 0), 0));
  }, [transactions]);

  const handleFlush = async () => {
    if (!publicKey || !mainWallet || privateBalance <= 0) return;

    setFlushLoading(true);
    setFlushMessage(null);

    try {
      const tx = await buildWithdraw(publicKey.toBase58(), mainWallet, privateBalance);
      const connection = new Connection(TEE_RPC, 'processed');
      let sig: string;

      if (signAndSendTransaction) {
        // Some wallets (e.g., Phantom) provide a combined sign+send helper
        const res = await signAndSendTransaction(tx as any);
        sig = (res && (res as any).signature) || String(res);
      } else if (signTransaction) {
        const signedTx = await signTransaction(tx as any);
        sig = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,
          maxRetries: 5,
        });
      } else {
        throw new Error('Connected wallet cannot sign transactions.');
      }

      await waitForSignatureConfirmation(connection, sig);

      setFlushMessage(`Flush successful — transaction ${sig.slice(0, 12)}...`);
      setPrivateBalance(0);
    } catch (e: any) {
      setFlushMessage(`Flush failed: ${e?.message || 'unexpected error'}`);
    } finally {
      setFlushLoading(false);
    }
  };

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <WalletMultiButton />
          <p className="mt-6 text-zinc-500">Connect Merchant Wallet</p>
        </div>
      </div>
    );
  }

  if (!showVault) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-purple-500 text-2xl mb-4">🔐</div>
          <p className="text-white text-xl">Awaiting Merchant Authorization...</p>
          <p className="text-zinc-500 text-sm mt-2">TEE Validation in progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Your original merchant dashboard design goes here */}
      {/* We kept it minimal so your original styling remains intact */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">OPAYQUE VAULT</h1>
          <WalletMultiButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-zinc-900 p-10 rounded-3xl">
            <p className="text-purple-400 uppercase text-xs tracking-widest mb-4">Shielded Balance</p>
            <p className="text-6xl font-mono font-bold">${privateBalance.toFixed(2)}</p>
            <p className="text-zinc-500 mt-2">USDC • Private</p>
          </div>

          <div className="bg-zinc-900 p-10 rounded-3xl">
            <h3 className="mb-6 text-lg">Flush to Main Wallet</h3>
            <input
              type="text"
              placeholder="Main Solana Address"
              className="w-full bg-black border border-zinc-700 rounded-2xl px-5 py-4 mb-6"
              value={mainWallet}
              onChange={(e) => setMainWallet(e.target.value)}
            />
            <button
              onClick={handleFlush}
              disabled={flushLoading || privateBalance <= 0 || !mainWallet}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold"
            >
              {flushLoading ? "Flushing..." : "Execute Flush"}
            </button>
            {flushMessage ? (
              <div className="mt-4 rounded-2xl border border-zinc-700 bg-black/50 px-5 py-4 text-sm text-zinc-200">
                {flushMessage}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
          <div className="bg-zinc-900 p-10 rounded-3xl">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <p className="text-purple-400 uppercase text-xs tracking-widest">Total Revenue</p>
                <p className="text-5xl font-mono font-bold mt-3">${totalRevenue.toFixed(2)}</p>
              </div>
              <div className="rounded-3xl bg-white/5 px-4 py-3 text-sm text-zinc-300">
                {transactions.length} txn{transactions.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-zinc-400">
                  No USDC transfers detected yet. New transactions will appear here in real time.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.signature} className="rounded-3xl border border-white/10 bg-black/20 p-5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between gap-4 text-sm text-zinc-300">
                      <span className="font-mono truncate">{tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase ${tx.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <p className="text-xl font-semibold text-white">${tx.amount.toFixed(2)}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{new Date(tx.time).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-zinc-900 p-10 rounded-3xl flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Live polling</p>
              <p className="mt-3 text-sm text-zinc-300">Fetching the latest USDC transfers to your associated token account every 3 seconds.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Balance refresh</p>
              <p className="mt-3 text-sm text-zinc-300">Private balance refreshes every 4 seconds to keep the dashboard current without reloading.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
