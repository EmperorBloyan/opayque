"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrency, CurrencyProvider } from "@/lib/context/CurrencyContext";

function DirectCheckoutContent() {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get("amount") || "10";
  const merchantParam = searchParams.get("merchant") || "Merchant";
  const titleParam = searchParams.get("title") || "Payment";

  const amountUsdc = parseFloat(amountParam);
  const { currency, setCurrency, rates, convert, isLoadingRates } = useCurrency();
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success">("idle");

  const converted = convert(amountUsdc);

  const handlePayment = () => {
    setPaymentStatus("processing");
    setTimeout(() => {
      setPaymentStatus("success");
    }, 2000);
  };

  const handleClose = () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "OPAYQUE_CLOSE" }, "*");
    } else {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 text-lg"
        >
          ✕
        </button>

        <div className="mb-6 border-b border-slate-800 pb-4">
          <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Direct Checkout
          </span>
          <h1 className="text-2xl font-bold mt-1">{titleParam}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pay to: {merchantParam}</p>
        </div>

        {/* Dual Pricing Display */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400 font-medium">Crypto Amount</span>
            <span className="text-lg font-bold text-emerald-400">
              {amountUsdc.toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800/60 pt-2">
            <span className="text-xs text-slate-400 font-medium">Equivalent Fiat</span>
            <span className="text-sm font-semibold text-slate-200">
              {isLoadingRates ? "Loading..." : converted.formatted}
            </span>
          </div>
        </div>

        {/* Currency Selector Dropdown */}
        <div className="mb-6">
          <label className="block text-xs text-slate-400 mb-1 font-medium">
            Select Display Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {Object.keys(rates).length > 0 ? (
              Object.keys(rates).map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))
            ) : (
              <option value="USD">USD</option>
            )}
          </select>
        </div>

        {/* Payment Action */}
        {paymentStatus === "success" ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 text-center">
            <p className="font-semibold text-lg">Payment Successful!</p>
            <p className="text-xs mt-1 text-emerald-300/80">
              Thank you for your purchase.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-sm hover:bg-emerald-400"
            >
              Close Window
            </button>
          </div>
        ) : (
          <button
            onClick={handlePayment}
            disabled={paymentStatus === "processing"}
            className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 text-sm"
          >
            {paymentStatus === "processing" ? "Processing..." : `Pay ${amountUsdc} USDC`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DirectCheckoutPage() {
  return (
    <CurrencyProvider>
      <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">Loading checkout...</div>}>
        <DirectCheckoutContent />
      </Suspense>
    </CurrencyProvider>
  );
}
