import React from "react";
import { createClient } from "@supabase/supabase-js";

import CheckoutClient from "./CheckoutClient";

interface Props {
  params: { id: string };
}

export default async function CheckoutPage({ params }: Props) {
  const { id } = params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("checkout_sessions")
    .select("id, amount, amount_fiat, amount_token, settlement_token, currency, customer_email, solana_pay_url, status")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h2 className="text-2xl font-bold text-white">Checkout not found</h2>
          <p className="text-sm text-zinc-400 mt-2">The requested checkout was not found or has expired.</p>
        </div>
      </main>
    );
  }

  const amountFiat = Number(data.amount_fiat ?? data.amount ?? 0);
  const settlementToken = (data.settlement_token || data.currency || "USDC").toUpperCase();
  const amountToken = Number(data.amount_token ?? data.amount ?? 0);

  const session = {
    id: data.id,
    amount: amountFiat,
    amount_fiat: amountFiat,
    amount_token: amountToken,
    settlement_token: settlementToken,
    currency: String(data.currency || "USD").toUpperCase(),
    customer_email: data.customer_email,
    solana_pay_url: data.solana_pay_url,
    status: data.status,
  };

  return (
    <main className="min-h-screen bg-[#050508] p-8 flex items-center justify-center">
      <CheckoutClient {...session} />
    </main>
  );
}
