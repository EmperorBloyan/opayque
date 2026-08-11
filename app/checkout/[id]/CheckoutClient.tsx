"use client";

import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check } from "lucide-react";

interface Props {
  id: string;
  amount: number;
  currency: string;
  customer_email?: string | null;
  solana_pay_url?: string | null;
}

export default function CheckoutClient({ id, amount, currency, customer_email, solana_pay_url }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/checkout/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setStatus(data.status || null);
        if (data.transaction?.signature) setTransactionSignature(data.transaction.signature);
        if (data.status === "completed") setSuccess(true);
      } catch (err) {
        console.error(err);
      }
    };

    poll();
    const iv = setInterval(poll, 2000);
    return () => { mounted = false; clearInterval(iv); };
  }, [id]);

  return (
    <div className="min-h-[60vh] max-w-xl mx-auto p-6 rounded-2xl bg-[#0b0c10] border border-white/5 shadow-lg">
      {!success ? (
        <div className="space-y-6 text-center">
          <h2 className="text-2xl font-extrabold text-white">Pay {currency} {Number(amount) / 100}</h2>
          {customer_email && <p className="text-sm text-zinc-400">Buyer's email: {customer_email}</p>}

          <div className="flex flex-col items-center gap-4">
            {solana_pay_url ? (
              <div className="bg-black/60 p-4 rounded-xl">
                <QRCodeCanvas value={solana_pay_url} size={220} fgColor="#a78bfa" />
              </div>
            ) : (
              <div className="h-[220px] w-[220px] rounded-xl bg-black/40 flex items-center justify-center text-zinc-500">No QR available</div>
            )}

            {solana_pay_url && (
              <a href={solana_pay_url} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold">Pay on this device</a>
            )}

            <div className="text-xs text-zinc-500">Status: <span className="text-white">{status ?? 'pending'}</span></div>
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
    </div>
  );
}
