"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ShieldedCheckout from "@/components/ShieldedCheckout";

function CheckoutContent() {
  const searchParams = useSearchParams();

  // Extract and fall back to default values
  const address = searchParams.get("address") || "";
  const name = searchParams.get("name") || "Registry Endpoint";
  
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

  const category = searchParams.get("category") || "Registry";

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
      <p className="mx-auto mb-4 max-w-md text-center text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        Shielded link active
      </p>
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
