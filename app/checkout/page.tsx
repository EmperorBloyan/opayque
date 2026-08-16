'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ShieldedCheckout from '@/components/ShieldedCheckout';

/**
 * Opayque Checkout Interface
 * Standard entry point for customers initiated via QR codes or terminal links.
 * Now supports displaying local Fiat currency while settling in USDC/Crypto.
 */
function CheckoutContent() {
  const searchParams = useSearchParams();

  const address = searchParams.get('address');
  const name = searchParams.get('name') || 'Secure Terminal';
  const currency = (searchParams.get('currency') || 'USD').toUpperCase();
  const token = (searchParams.get('token') || 'USDC').toUpperCase();

  // Parse settlement amount (crypto) and display amount (fiat)
  const usdcAmount = Number(searchParams.get('amount') || searchParams.get('fixed') || '0');
  const fiatAmount = Number(searchParams.get('fiat_amount') || usdcAmount || '0');

  const safeUsdc = Number.isFinite(usdcAmount) && usdcAmount > 0 ? usdcAmount : 0;
  const safeFiat = Number.isFinite(fiatAmount) && fiatAmount > 0 ? fiatAmount : safeUsdc;

  if (!address) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="max-w-md rounded-[3rem] border border-red-500/10 bg-zinc-900 p-12 shadow-2xl">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-red-500/60">
            Protocol Failure
          </p>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
            Missing Parameters
          </h2>
          <p className="mt-6 text-[10px] font-bold uppercase leading-relaxed tracking-widest text-zinc-600">
            Deployment address or terminal identity not found in request payload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6">
      {/* Ambient Visuals (visible through component backdrop) */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/5 blur-[120px]" />

      <div className="mb-6 text-center duration-1000 animate-in fade-in zoom-in">
        <h1 className="mb-4 text-[11px] font-black italic uppercase tracking-[0.5em] text-zinc-700">
          {name}
        </h1>

        <p className="text-4xl font-black text-white">
          {safeFiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          <span className="text-lg text-zinc-400">{currency}</span>
        </p>
        <p className="mt-2 font-mono text-sm text-purple-300">
          ≈ {safeUsdc.toFixed(2)} {token}
        </p>

        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500">
            Shielded Link Active
          </span>
        </div>
      </div>

      <ShieldedCheckout
        amount={safeUsdc}
        merchantPubkey={address}
        recipientName={name}
        allowCustomAmount={safeUsdc <= 0}
        displayCurrency={currency}
        displayFiatAmount={safeFiat}
        settlementToken={token}
      />
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <CheckoutContent />
    </Suspense>
  );
}
