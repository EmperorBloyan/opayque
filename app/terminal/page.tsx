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
  const qrRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const MINT =
    process.env.NEXT_PUBLIC_USDC_MINT ||
    "Gh9ZwE9pk6fGst87fM7W6oY2i7m5wR8E3j28b9yWv352";

  // Derived numeric values
  const numericAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount < 1_000_000;

  // Mount + auto sign-in for returning devices
  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("terminal_paired") === "true") {
      setStep("POS");
    }
  }, []);

  // Autofocus pairing input when showing PAIRING
  useEffect(() => {
    if (step === "PAIRING" && mounted) {
      const t = window.setTimeout(() => pairingRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step, mounted]);

  // Escape key returns to POS from PAYING
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step === "PAYING" && !isPaid) {
        setStep("POS");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, isPaid]);

  // Toast auto-clear with cleanup
  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    };
  }, [toast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  // Safe ID generator (crypto.randomUUID fallback)
  const makeId = useCallback(() => {
    try {
      if (typeof crypto?.randomUUID === "function") {
        return crypto.randomUUID().split("-")[0].toUpperCase();
      }
    } catch {}
    return Math.random().toString(36).slice(2, 9).toUpperCase();
  }, []);

  // Audio with WebAudio fallback
  const playSuccessAudio = useCallback(() => {
    // Try remote audio first (may be blocked in some browsers)
    const url =
      "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3";
    const audio = new Audio(url);
    audio.volume = 0.35;
    audio.play().catch(() => {
      // Fallback beep using WebAudio
      try {
        const Ctx =
          (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.06;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 160);
      } catch {
        // ignore if WebAudio not available
      }
    });
  }, []);

  // Build safe QR URI
  const buildUri = useCallback(() => {
    const mint = encodeURIComponent(MINT);
    const amt = isAmountValid ? encodeURIComponent(numericAmount.toFixed(2)) : "0.00";
    const label = encodeURIComponent("Opayque POS");
    return `solana:${mint}?amount=${amt}&label=${label}`;
  }, [MINT, numericAmount, isAmountValid]);

  // Clamp and sanitize amount input (max 2 decimals)
  const handleAmountChange = (v: string) => {
    if (v === "") {
      setAmount("");
      return;
    }
    // Remove non-numeric except dot
    const cleaned = v.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const intPart = parts[0] || "0";
    const decPart = parts[1] || "";
    const decClamped = decPart.slice(0, 2);
    const intClamped = intPart.replace(/^0+(?=\d)/, "") || "0";
    setAmount(decClamped ? `${intClamped}.${decClamped}` : intClamped);
  };

  // Pairing handler (demo bypass gated)
  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    const activeCode = localStorage.getItem("active_pairing_code");

    if (activeCode && pairingCode === activeCode) {
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      localStorage.removeItem("active_pairing_code");
      setToast("Terminal paired successfully");
      setTimeout(() => pairingRef.current?.blur(), 50);
    } else if (DEMO && pairingCode === "123456") {
      // Demo-only bypass
      console.warn("Demo mode bypass used");
      setStep("POS");
      localStorage.setItem("terminal_paired", "true");
      setToast("Demo Mode: Master Bypass Active");
      setTimeout(() => pairingRef.current?.blur(), 50);
    } else {
      setToast("Invalid Auth Token");
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  // Trigger success (simulate payment)
  const triggerSuccess = useCallback(() => {
    if (isPaid || !isAmountValid) return;

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    playSuccessAudio();

    const newTx = {
      id: makeId(),
      staff: "Terminal #01",
      amount: numericAmount,
      time: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("opayque_tx") || "[]");
      localStorage.setItem("opayque_tx", JSON.stringify([newTx, ...existing]));
    } catch {
      localStorage.setItem("opayque_tx", JSON.stringify([newTx]));
    }

    const currentBalance = Number(localStorage.getItem("opayque_balance") || "0");
    localStorage.setItem(
      "opayque_balance",
      String(Number((currentBalance + numericAmount).toFixed(2)))
    );

    setIsPaid(true);
    setToast("Payment received");

    // Move focus to success indicator for screen readers
    setTimeout(() => {
      successRef.current?.focus();
    }, 120);

    // Auto-reset after 4s with cleanup
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setIsPaid(false);
      setStep("POS");
      setAmount("");
      resetTimer.current = null;
    }, 4000);
  }, [isPaid, isAmountValid, numericAmount, makeId, playSuccessAudio]);

  if (!mounted) return null;

  const displayAmount = Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : "0.00";
  const qrUri = buildUri();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans selection:bg-purple-500/30">
      <div className="w-full max-w-md">
        {/* PAIRING */}
        {step === "PAIRING" && (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <h1 className="text-3xl font-black italic mb-2 uppercase">Opayque</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-12">
              Shielded Terminal
            </p>

            <form onSubmit={handlePairing}>
              <input
                ref={pairingRef}
                aria-label="Pairing Code"
                inputMode="numeric"
                pattern="\d*"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-6xl font-mono font-black outline-none mb-6 focus:border-purple-500/30 transition-all"
              />
              <button
                type="submit"
                className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-transform"
                aria-label="Pair device"
              >
                Pair Device
              </button>
            </form>
          </div>
        )}

        {/* POS */}
        {step === "POS" && (
          <div className="bg-zinc-900 border border-white/5 rounded-[4rem] p-10 animate-in slide-in-from-bottom duration-700">
            <div className="flex justify-between items-center mb-6 px-4">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                Charge (USDC)
              </span>
              <button
                onClick={() => {
                  if (confirm("Unpair this terminal?")) {
                    localStorage.removeItem("terminal_paired");
                    setStep("PAIRING");
                  }
                }}
                className="text-[9px] font-bold text-red-500/50 hover:text-red-500 uppercase transition-colors"
                aria-label="Unpair device"
              >
                Unpair
              </button>
            </div>

            <div className="bg-black rounded-[3rem] p-12 mb-10 border border-white/5 shadow-inner">
              <div className="flex items-center justify-center">
                <span className="text-2xl font-bold text-zinc-800 mr-2">$</span>
                <input
                  aria-label="Transaction Amount"
                  inputMode="decimal"
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="bg-transparent text-7xl font-mono font-bold text-center outline-none w-full placeholder:text-zinc-900"
                />
              </div>
              {!isAmountValid && amount !== "" && (
                <p className="text-[10px] text-zinc-500 mt-4 text-center">Enter a valid amount greater than 0.00</p>
              )}
            </div>

            <button
              onClick={() => setStep("PAYING")}
              disabled={!isAmountValid}
              className="w-full py-8 bg-purple-600 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-purple-500/20 disabled:opacity-20 transition-all uppercase tracking-tighter"
              aria-disabled={!isAmountValid}
              aria-label="Generate QR"
            >
              Generate QR
            </button>
          </div>
        )}

        {/* PAYING */}
        {step === "PAYING" && (
          <div className="text-center animate-in zoom-in duration-500">
            {isPaid ? (
              <div
                ref={successRef}
                tabIndex={-1}
                aria-live="polite"
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                  <span className="text-4xl italic font-black">✓</span>
                </div>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter">Settled</h2>
                <p className="text-zinc-500 text-xs mt-4 font-mono">Vault update propagated</p>
              </div>
            ) : (
              <div>
                <div
                  ref={qrRef}
                  role="button"
                  tabIndex={0}
                  onClick={triggerSuccess}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") triggerSuccess();
                  }}
                  aria-label="Simulate payment"
                  className="p-10 bg-white rounded-[4rem] inline-block mb-10 border-[16px] border-zinc-900 shadow-2xl cursor-pointer active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                >
                  <QRCodeSVG value={qrUri} size={220} level="H" />
                </div>

                <h2 className="text-6xl font-mono font-bold tracking-tighter mb-2">${displayAmount}</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] animate-pulse">Scan to Pay</p>
                <p className="mt-8 text-zinc-700 text-[9px] uppercase font-bold tracking-widest">[ ESC ] to cancel</p>
                {DEMO && (
                  <p className="mt-4 text-[8px] text-zinc-800 uppercase font-black tracking-widest">
                    (Tap QR to simulate payment)
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOAST SYSTEM */}
      <div aria-live="polite" className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
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
