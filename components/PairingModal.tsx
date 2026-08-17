"use client";

import React, { useEffect, useState } from "react";
import {
  LucideCheck,
  LucideCopy,
  LucideRefreshCw,
  LucideShieldCheck,
  LucideClock3,
  LucideX,
  LucideSmartphone,
} from "lucide-react";

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  authCode: string;
  onRefresh: () => void;
  timeLeft: string;
  terminalName?: string;
  onTerminalNameChange?: (value: string) => void;
  pairingState?: "idle" | "waiting" | "used";
}

export default function PairingModal({
  isOpen,
  onClose,
  authCode,
  onRefresh,
  timeLeft,
  terminalName,
  onTerminalNameChange,
  pairingState = "idle",
}: PairingModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  // Auto-close shortly after successful pair so parent can refresh fleet
  useEffect(() => {
    if (!isOpen || pairingState !== "used") return;
    const t = window.setTimeout(() => onClose(), 1200);
    return () => window.clearTimeout(t);
  }, [isOpen, pairingState, onClose]);

  const copyCode = async () => {
    try {
      if (!authCode) return;
      await navigator.clipboard.writeText(authCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#121218] p-6 shadow-2xl shadow-black/60">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-zinc-400 transition-all hover:text-white"
            aria-label="Close pairing modal"
          >
            <LucideX size={18} />
          </button>
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30">
            <LucideSmartphone size={28} />
          </div>
          <h3 className="mt-5 text-2xl font-black uppercase italic tracking-[0.2em] text-white">
            Terminal Pairing
          </h3>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Security window active. Enter this code on your device.
          </p>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-[#050507] p-4">
          <div className="mb-3">
            <label className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-600">
              Terminal Name
            </label>
            <input
              value={terminalName ?? ""}
              onChange={(e) => onTerminalNameChange?.(e.target.value)}
              placeholder="Front Desk 1, Bar Tablet"
              className="mt-2 w-full rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 rounded-[1.25rem] border border-white/10 bg-black/50 px-4 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.35em] text-zinc-600">
                Auth Code
              </p>
              <p className="mt-2 font-mono text-3xl font-black tracking-[0.4em] text-white">
                {authCode}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={copyCode}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                  copied
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                aria-label="Copy auth code"
              >
                {copied ? <LucideCheck size={16} /> : <LucideCopy size={16} />}
              </button>
              <button
                onClick={onRefresh}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 transition-all hover:bg-purple-500/20"
                aria-label="Refresh auth code"
              >
                <LucideRefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-green-500">
              <LucideShieldCheck size={14} /> Tee Verified
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              <LucideClock3 size={14} /> Valid for: {timeLeft}
            </div>
          </div>

          {pairingState === "waiting" ? (
            <div className="mt-4 rounded-md bg-yellow-900/30 px-3 py-2 text-center text-yellow-300 text-sm font-bold">
              Awaiting login...
            </div>
          ) : pairingState === "used" ? (
            <div className="mt-4 rounded-md bg-green-900/30 px-3 py-2 text-center text-green-300 text-sm font-bold">
              Login successful — terminal connected
            </div>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-white px-5 py-4 text-[11px] font-black uppercase tracking-[0.3em] text-black transition-all hover:bg-zinc-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}