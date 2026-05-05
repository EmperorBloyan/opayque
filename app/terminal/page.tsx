"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pairingRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  // Demo mode toggle
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  // Derived numeric values
  const numericAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount < 1_000_000;

  // Build QR URI
  const buildUri = useCallback(() => {
    const mint = encodeURIComponent("USDC-DEMO");
    const amt = isAmountValid ? encodeURIComponent(numericAmount.toFixed(2)) : "0.00";
    const label = encodeURIComponent("Opayque POS");
    return `solana:${mint}?amount=${amt}&label=${label}`;
  }, [numericAmount, isAmountValid]);

  // Pairing handler
  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    if (pairingCode === "123456" || (DEMO && pairingCode === "123456")) {
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      setToast("Terminal paired successfully");
    } else {
      setToast("Invalid Auth Token");
    }
  };

  // Trigger success (simulate payment)
  const triggerSuccess = useCallback(() => {
    if (isPaid || !isAmountValid) return;
    setIsPaid(true);
    setToast("Payment received");
    setTimeout(() => {
      successRef.current?.focus();
    }, 120);
  }, [isPaid, isAmountValid]);

  // Mount + auto sign-in
  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("terminal_paired") === "true") {
      setStep("POS");
    }
  }, []);

  if (!mounted) return null;

  const qrUri = buildUri();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        {/* PAIRING */}
        {step === "PAIRING" && (
          <form onSubmit={handlePairing} className="text-center">
            <input
              ref={pairingRef}
              aria-label="Pairing Code"
              inputMode="numeric"
              pattern="\d*"
              type="text"
              maxLength={6}
              placeholder="000000"
              value={pairingCode}
              onChange={(e) =>
                setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-6xl font-mono font-black outline-none mb-6"
            />
            <button
              type="submit"
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              Pair Device
            </button>
          </form>
        )}

        {/* POS */}
        {step === "POS" && (
          <div className="text-center">
            <input
              aria-label="Transaction Amount"
              inputMode="decimal"
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full"
            />
            <button
              onClick={() => setStep("PAYING")}
              disabled={!isAmountValid}
              className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl disabled:opacity-20 uppercase tracking-tighter"
            >
              Generate QR
            </button>
          </div>
        )}

        {/* PAYING */}
        {step === "PAYING" && (
          <div className="text-center">
            {!isPaid ? (
              <div
                ref={successRef}
                role="button"
                tabIndex={0}
                onClick={triggerSuccess}
                className="p-10 bg-white rounded-[4rem] inline-block mb-10 border-[16px] border-zinc-900 shadow-2xl cursor-pointer"
              >
                <QRCodeSVG value={qrUri} size={220} level="H" />
              </div>
            ) : (
              <div
                ref={successRef}
                tabIndex={-1}
                aria-live="polite"
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mb-6">
                  <span className="text-4xl italic font-black">✓</span>
                </div>
                <h2 className="text-5xl font-black italic uppercase">Settled</h2>
              </div>
            )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}