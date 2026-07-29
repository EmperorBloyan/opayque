"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShieldedCheckout from "@/components/ShieldedCheckout";

function CheckoutContent() {
  const searchParams = useSearchParams();

  const recipientAddress = searchParams.get("address") || "8YAV5vV3Nf2zPx9WCjyqkFKTAa55Hjnhm8FDCAEHEM76";
  const recipientName = searchParams.get("name") || "Opayque Recipient";
  const rawAmount = searchParams.get("amount") || searchParams.get("fixed") || "0";
  const amount = Number.parseFloat(rawAmount);

  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-600">Secure Checkout</p>
        <h1 className="mt-2 text-3xl font-black italic uppercase tracking-tighter">{recipientName}</h1>
      </div>
      <ShieldedCheckout amount={safeAmount} merchantPubkey={recipientAddress} />
    </div>
  );
}

export default function SmartCheckout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Initialising Shielded Session...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
