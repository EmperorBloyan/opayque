"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getActiveSession } from "@/lib/crypto/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generatePaymentURL } from "@/lib/solana/pay";
import type { TransactionRecord } from "@/types/database";

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"PAIRING" | "POS" | "PAYING">("PAIRING");
  const [pairingCode, setPairingCode] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"USDC" | "USDT" | "SOL">("USDC");
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const pairingRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const activeSession = getActiveSession();

  const numericAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount < 1_000_000;

  const buildUri = useCallback(() => {
    const recipient = activeSession?.walletAddress ?? "11111111111111111111111111111111";
    return generatePaymentURL({
      recipient,
      amount: isAmountValid ? numericAmount.toFixed(2) : "0.00",
      splToken: asset === "SOL" ? null : asset,
      reference: transactionId ?? undefined,
      label: `Opayque POS ${asset}`,
      message: `Secure ${asset} checkout via Opayque`,
    });
  }, [activeSession?.walletAddress, asset, isAmountValid, numericAmount, transactionId]);

  const handlePairing = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = pairingCode.trim().toUpperCase();

    if (typeof window === "undefined") {
      setToast("Pairing code rejected");
      return;
    }

    try {
      const storedTerminals = JSON.parse(window.localStorage.getItem("opayque_terminals") || "[]") as Array<{
        id: string;
        accessCode?: string;
        isActive?: boolean;
      }>;
      const matchedTerminal = storedTerminals.find(
        (terminal) => terminal.accessCode?.toUpperCase() === normalizedCode && !terminal.isActive
      );

      if (matchedTerminal) {
        const updatedTerminals = storedTerminals.map((terminal) =>
          terminal.id === matchedTerminal.id
            ? { ...terminal, isActive: true, lastLoginAt: Date.now() }
            : terminal
        );
        window.localStorage.setItem("opayque_terminals", JSON.stringify(updatedTerminals));
        window.dispatchEvent(new Event("opayque-terminal-login"));
        setStep("POS");
        setToast("Terminal paired successfully");
        return;
      }

      if (storedTerminals.some((terminal) => Boolean(terminal.accessCode))) {
        setToast("Invalid or expired pairing code");
        return;
      }

      setToast("No terminal pairing code is configured.");
    } catch {
      setToast("Pairing code rejected");
    }
  };

  const triggerSuccess = useCallback(async () => {
    if (isPaid || !isAmountValid) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          merchant_id: activeSession?.merchantId ?? "00000000-0000-0000-0000-000000000000",
          terminal_id: null,
          signature: null,
          token_symbol: asset,
          amount: numericAmount,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setTransactionId((data as TransactionRecord).id);
      setToast("Pending transaction registered in Supabase");
      setIsPaid(true);
      requestAnimationFrame(() => {
        successRef.current?.focus();
      });
      return;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Transaction registration failed.");
    }
  }, [activeSession?.merchantId, asset, isAmountValid, isPaid, numericAmount]);

  useEffect(() => {
    setMounted(true);
    if (activeSession) {
      setStep("POS");
    }
  }, [activeSession]);

  useEffect(() => {
    if (!transactionId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`transactions:${transactionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${transactionId}` },
        (payload) => {
          const record = payload.new as TransactionRecord | null;
          if (record?.status) {
            setToast(`Transaction status: ${record.status}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

  if (!mounted) return null;

  const qrUri = buildUri();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        {step === "PAIRING" && (
          <form onSubmit={handlePairing} className="text-center">
            <input
              ref={pairingRef}
              aria-label="Pairing Code"
              inputMode="text"
              type="text"
              maxLength={12}
              placeholder="000000"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 12))}
              className="w-full bg-zinc-900 border border-white/5 rounded-3xl py-10 text-center text-4xl font-mono font-black outline-none mb-6"
            />
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Use the generated fleet code to unlock the staff terminal.
            </p>
            <button
              type="submit"
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              Pair Device
            </button>
          </form>
        )}

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

        {toast && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}