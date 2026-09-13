"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("Check your email for a password reset link.");
      alert("Check your email for a password reset link.");
    }

    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-lg rounded-[3rem] border border-white/10 bg-zinc-900/70 p-8 shadow-[0_0_40px_rgba(168,85,247,0.18)] sm:p-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="mt-10">
          <p className="text-xs uppercase tracking-[0.45em] text-purple-400">Account Recovery</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-tight">Reset password</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Enter your email and we will send you a single-use password reset link.
          </p>
        </div>

        <form onSubmit={requestPasswordReset} className="mt-8 space-y-6">
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
            Email address
            <div className="mt-3 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
              <div className="flex items-center gap-3 text-zinc-400">
                <Mail className="h-4 w-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                  required
                />
              </div>
            </div>
          </label>

          {error && <p className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sending..." : "Send reset link"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </main>
  );
}