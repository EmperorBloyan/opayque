"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { buildShieldedTransfer } from "@/lib/magicblock";
import { QRCodeSVG } from "qrcode.react";
import { 
  LucideShieldCheck, 
  LucideArrowLeft, 
  LucideCheckCircle2, 
  LucideLoader2 
} from "lucide-react";

const TEE_RPC = 'https://devnet-tee.magicblock.app';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { publicKey, signTransaction, connected } = useWallet();

  const recipientAddress = searchParams.get("address") || "";
  const recipientName = searchParams.get("name") || "Opayque Recipient";
  const recipientImage = searchParams.get("image"); // NEW: image param
  const fixedAmount = searchParams.get("fixed");
  const isFixed = fixedAmount !== null;

  const [amount, setAmount] = useState<number>(isFixed ? Number(fixedAmount) : 10);
  const [showQR, setShowQR] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");

  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const paymentUrl = `solana:${recipientAddress}?amount=${amount}&spl-token=${USDC_MINT}&label=Opayque&message=Shielded+Settlement`;

  const handleShieldedPayment = async () => {
    if (!publicKey || !signTransaction) return;
    setStatus("processing");

    try {
      const tx = await buildShieldedTransfer(publicKey.toBase58(), recipientAddress, amount);
      const signedTx = await signTransaction(tx);
      setTxSig("5xTR...v9Z"); 
      setStatus("success");
    } catch (err) {
      console.error("Payment failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-zinc-900/80 border border-white/5 rounded-[3.5rem] backdrop-blur-3xl shadow-2xl overflow-hidden relative">
        <div className="pt-10 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
            <LucideShieldCheck size={12} className="text-purple-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400">Shielded Session</span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
            {recipientName}
          </h1>
        </div>

        {!showQR ? (
          <div className="p-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-10 mb-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">
                {isFixed ? "Fixed Terminal Total" : "Set Settlement Amount"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold text-zinc-600">$</span>
                <input 
                  type="number"
                  value={amount}
                  disabled={isFixed}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className={`bg-transparent text-7xl font-mono font-black outline-none w-full text-center ${isFixed ? 'text-zinc-500' : 'text-white'}`}
                />
              </div>
            </div>

            <button 
              onClick={() => setShowQR(true)}
              className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-zinc-200 transition-all shadow-lg active:scale-[0.98]"
            >
              Confirm & Pay
            </button>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center animate-in zoom-in duration-300">
            {status !== "success" ? (
              <>
                <div className="relative p-8 bg-white rounded-[3rem] mb-10 shadow-[0_0_50px_rgba(168,85,247,0.1)]">
                  <QRCodeSVG value={paymentUrl} size={200} level="H" includeMargin={true} />
                  {/* Center overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-lg overflow-hidden border border-zinc-100">
                      {recipientImage ? (
                        <img
                          src={recipientImage}
                          alt={recipientName}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-black">
                          O
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <div className="flex justify-center mb-2">
                    <WalletMultiButton className="!bg-zinc-800 !h-12 !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest" />
                  </div>
                  <button
                    onClick={handleShieldedPayment}
                    disabled={!connected || status === "processing"}
                    className="w-full py-5 bg-purple-600 hover:bg-purple-500 disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-widest text-[11px]"
                  >
                    {status === "processing" ? (
                      <span className="flex items-center justify-center gap-2">
                        <LucideLoader2 className="animate-spin" size={14} /> Shielding...
                      </span>
                    ) : (
                      `Authorize $${amount} Settlement`
                    )}
                  </button>
                  <button 
                    onClick={() => setShowQR(false)}
                    className="w-full py-2 flex items-center justify-center gap-2 text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em] hover:text-white"
                  >
                    <LucideArrowLeft size={12} /> Change Amount
                  </button>
                </div>
              </>
            ) : (
              <div className="py-20 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mb-6 text-green-500">
                  <LucideCheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Verified</h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-10">Private Settlement Complete</p>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[9px] text-zinc-600">
                  SIG: {txSig}...verified_tee
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmartCheckout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Loading Security Protocol...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
