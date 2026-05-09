'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ShieldedCheckout from '@/components/ShieldedCheckout';

/**
 * Opayque Terminal Interface
 * Standard entry point for customers initiated via QR codes or hardware terminals.
 */
function CheckoutContent() {
  const searchParams = useSearchParams();
  
  const address = searchParams.get('address');
  const name = searchParams.get('name') || 'Secure Terminal';
  
  // Support both 'amount' and 'fixed' (price) params from TerminalManager
  const rawAmount = searchParams.get('amount') || searchParams.get('fixed') || '0';
  const amount = parseFloat(rawAmount);

  if (!address) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div className="bg-zinc-900 border border-red-500/10 rounded-[3rem] p-12 max-w-md shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500/60 mb-2">Protocol Failure</p>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Missing Parameters</h2>
          <p className="text-[10px] text-zinc-600 mt-6 leading-relaxed uppercase font-bold tracking-widest">
            Deployment address or terminal identity not found in request payload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient Visuals (visible through component backdrop) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10" />
      
      <div className="text-center animate-in fade-in zoom-in duration-1000">
        <h1 className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-700 mb-4 italic">{name}</h1>
        <div className="flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500">Shielded Link Active</span>
        </div>
      </div>

      <ShieldedCheckout amount={amount} merchantPubkey={address} />
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
