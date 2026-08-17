"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShieldedCheckout from "@/components/ShieldedCheckout";

function CheckoutContent() {
  const searchParams = useSearchParams();

  // Extract and fall back to default values
  const address = searchParams.get("address") || "";
  const name = searchParams.get("name") || "Registry Endpoint";
  const category = searchParams.get("category") || "Registry";
  
  // Safely parse the amount
  const amount = Number(searchParams.get("amount") || searchParams.get("fixed") || "0");
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

  // Prevent loading the checkout flow if no recipient address is provided
  if (!address) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Missing endpoint address
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{category}</p>
        <h1 className="mt-2 text-2xl font-black text-white">{name}</h1>
      </div>

      <ShieldedCheckout
        amount={safeAmount}
        merchantPubkey={address}
        recipientName={name}
        endpointName={name}
        endpointCategory={category}
        allowCustomAmount={safeAmount <= 0}
      />
    </main>
  );
}

export default function VaultCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Initialising Shielded Session...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
