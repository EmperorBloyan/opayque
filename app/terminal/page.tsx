"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function EnterpriseTerminal() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pairingRef = useRef<HTMLInputElement | null>(null);

  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const MINT = process.env.NEXT_PUBLIC_USDC_MINT || "Gh9ZwE9pk6fGst87fM7W6oY2i7m5wR8E3j28b9yWv352";
  const STAFF_NAME = "Terminal #01";

  // Amount Validation
  const numericAmount = Number(amount);
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount < 1_000_000;

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("terminal_paired") === "true") setStep("POS");
  }, []);

  // Autofocus pairing input when showing PAIRING
  useEffect(() => {
    if (step === "PAIRING") {
      setTimeout(() => pairingRef.current?.focus(), 50);
    }
  }, [step]);

  // Toast cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Escape key returns to POS from PAYING
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === "PAYING") setStep("POS");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    const activeCode = localStorage.getItem("active_pairing_code");

    if (activeCode && pairingCode === activeCode) {
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      localStorage.removeItem("active_pairing_code");
      setToast("Terminal paired successfully");
    } else if (DEMO && pairingCode === "123456") {
      // Emergency bypass only in demo mode
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      setToast("Demo Mode: Emergency bypass active");
    } else {
      setToast("Invalid auth token");
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const playSuccessAudio = useCallback(() => {
    const url = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3";
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(() => {
      // fallback beep using WebAudio if remote audio blocked
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 200);
      } catch {
        // ignore if WebAudio not available
      }
    });
  }, []);

  const triggerSuccess = useCallback(() => {
    if (isPaid || !isAmountValid) return;

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    playSuccessAudio();

    const newTx = {
      id: crypto.randomUUID().split("-")[0].toUpperCase(),
      staff: STAFF_NAME,
      amount: numericAmount,
      time: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
    localStorage.setItem("opayque_tx", JSON.stringify([newTx, ...existing]));

    const currentBalance = Number(localStorage.getItem("opayque_balance") || "0");
    localStorage.setItem("opayque_balance", String(Number((currentBalance + numericAmount).toFixed(2))));

    setIsPaid(true);
    setToast("Payment received");
    setTimeout(() => {
      setIsPaid(false);
      setStep("POS");
      setAmount("");
    }, 4000);
  }, [numericAmount, isPaid, isAmountValid, playSuccessAudio]);

  // Prevent negative input and clamp decimals to 2 places on change
  const handleAmountChange = (v: string) => {
    // allow empty
    if (v === "") {
      setAmount("");
      return;
    }
    // remove leading zeros and non-numeric chars except dot
    const cleaned = v.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let integer = parts[0] || "0";
    // clamp integer length
    if (integer.length > 12) integer = integer.slice(0, 12);
    let decimal = parts[1] || "";
    if (decimal.length > 2) decimal = decimal.slice(0, 2);
    const composed = decimal ? `${integer}.${decimal}` : integer;
    setAmount(composed);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step === "PAIRING" && (
          <div className="text-center animate-in fade-in zoom-in">
            <h1 className="text-3xl font-black italic mb-2 uppercase">Opayque</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-12">Shielded Terminal</p>
            <form onSubmit={handlePairing}>
              <input
                ref={pairingRef}
                aria-label="Pairing Code"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-6xl font-mono font-black outline-none mb-6 focus:border-purple-500/30"
              />
              <button
                type="submit"
                className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs"
                aria-label="Pair device"
              >
                Pair Device
              </button>
            </form>
          </div>
        )}

        {step === "POS" && (
          <div className="bg-zinc-900 border border-white/5 rounded-[4rem] p-10 animate-in zoom-in">
            <div className="bg-black rounded-[3rem] p-12 mb-10 border border-white/5 shadow-inner">
              <p className="text-center text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-6">Enter Charge (USDC)</p>
              <div className="flex items-center justify-center">
                <span className="text-2xl font-bold text-zinc-800 mr-2">$</span>
                <input
                  aria-label="Transaction Amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full"
                />
              </div>
            </div>

            <button
              onClick={() => setStep("PAYING")}
              disabled={!isAmountValid}
              className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-purple-500/20 disabled:opacity-20"
              aria-disabled={!isAmountValid}
              aria-label="Generate QR"
            >
              CHARGE
            </button>

            {!isAmountValid && (
              <p className="text-[10px] text-zinc-500 mt-3 text-center">Enter a valid amount greater than 0.00</p>
            )}

            <button
              onClick={() => {
                localStorage.removeItem("terminal_paired");
                setStep("PAIRING");
              }}
              className="w-full mt-6 text-[9px] font-bold text-zinc-600 uppercase"
              aria-label="Unpair device"
            >
              Unpair Device
            </button>
          </div>
        )}

        {step === "PAYING" && (
          <div className="text-center">
            {isPaid ? (
              <div className="animate-in zoom-in">
                <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                  <span className="text-4xl italic font-black">✓</span>
                </div>
                <h2 className="text-5xl font-black italic uppercase">Settled</h2>
                <p className="text-zinc-500 text-xs mt-4 font-mono">Vault updated successfully</p>
              </div>
            ) : (
              <div className="animate-in zoom-in">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={triggerSuccess}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") triggerSuccess();
                  }}
                  aria-label="Simulate payment"
                  className="p-10 bg-white rounded-[4rem] inline-block mb-8 border-[12px] border-zinc-900 shadow-2xl cursor-pointer active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                >
                  <QRCodeSVG
                    value={`solana:${encodeURIComponent(MINT)}?amount=${numericAmount}&label=${encodeURIComponent("Opayque POS")}`}
                    size={200}
                    level="H"
                  />
                </div>

                <h2 className="text-6xl font-mono font-bold mb-2">
                  ${isAmountValid ? numericAmount.toFixed(2) : "0.00"}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase animate-pulse tracking-[0.4em]">Scan to Pay</p>
                {DEMO && <p className="mt-8 text-[8px] text-zinc-800 uppercase font-black tracking-widest">(Tap QR to simulate success)</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite" className="fixed bottom-10 left-1/2 transform -translate-x-1/2">
        {toast && (
          <div
            role="status"
            className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-bottom"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
