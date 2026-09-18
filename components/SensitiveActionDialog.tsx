"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, X } from "lucide-react";
import type { SensitivePasswordRequest } from "@/lib/client/reauthenticate";

export default function SensitiveActionDialog() {
  const [request, setRequest] = useState<SensitivePasswordRequest | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const nextRequest = (event as CustomEvent<SensitivePasswordRequest>).detail;
      setPassword("");
      setShowPassword(false);
      setRequest(nextRequest);
    };

    window.addEventListener("opayque:reauth-request", handleRequest);
    return () => window.removeEventListener("opayque:reauth-request", handleRequest);
  }, []);

  useEffect(() => {
    if (!request) return;
    inputRef.current?.focus();
  }, [request]);

  const close = () => {
    request?.reject(new Error("Password confirmation is required."));
    setRequest(null);
    setPassword("");
    setShowPassword(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    request?.resolve(password);
    setRequest(null);
    setPassword("");
    setShowPassword(false);
  };

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [request]);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#101016] shadow-[0_24px_100px_rgba(0,0,0,0.65)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitive-action-title"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.3),transparent_70%)]" />
        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/15 text-purple-300 shadow-[0_0_24px_rgba(168,85,247,0.2)]">
                <LockKeyhole size={19} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-purple-300/80">Sensitive action</p>
                <h2 id="sensitive-action-title" className="mt-1 text-xl font-black tracking-tight text-white">Confirm your identity</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              aria-label="Cancel password confirmation"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-6 text-sm leading-6 text-zinc-400">
            Enter your password to continue. This protects wallet, profile, and API key changes.
          </p>

          <form onSubmit={submit} className="mt-5">
            <label htmlFor="sensitive-action-password" className="block text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
              Account password
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 transition focus-within:border-purple-400/60 focus-within:bg-black/50">
              <LockKeyhole size={16} className="shrink-0 text-zinc-600" />
              <input
                ref={inputRef}
                id="sensitive-action-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="shrink-0 text-zinc-500 transition hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={!password}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.24em] text-white shadow-[0_0_28px_rgba(147,51,234,0.28)] transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck size={15} />
              Verify and continue
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            <ShieldCheck size={13} className="text-emerald-400/70" />
            Re-authentication required for your protection
          </div>
        </div>
      </div>
    </div>
  );
}
