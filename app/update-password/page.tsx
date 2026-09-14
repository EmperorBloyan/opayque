"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        setError("This password reset link is invalid or has expired. Request a new one.");
        setIsCheckingSession(false);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("This password reset link is invalid or has expired. Request a new one.");
          setIsCheckingSession(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/forgot-password";
        return;
      }

      setIsCheckingSession(false);
    };

    void checkSession();
  }, []);

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    await supabase.auth.signOut();
    alert("Password updated successfully.");
    window.location.href = "/login";
  };

  if (isCheckingSession) {
    return <main className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-400">Verifying reset link...</main>;
  }

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
          <h1 className="mt-4 text-4xl font-black uppercase tracking-tight">Choose a new password</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">Use at least 8 characters, then confirm your new password.</p>
        </div>

        {error && !newPassword && (
          <p className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
        )}

        <form onSubmit={updatePassword} className="mt-8 space-y-6">
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
            New password
            <div className="mt-3 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
              <div className="flex items-center gap-3 text-zinc-400">
                <Lock className="h-4 w-4" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                  minLength={8}
                  required
                />
              </div>
            </div>
          </label>

          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
            Confirm password
            <div className="mt-3 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
              <div className="flex items-center gap-3 text-zinc-400">
                <Lock className="h-4 w-4" />
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                  minLength={8}
                  required
                />
              </div>
            </div>
          </label>

          {error && newPassword && <p className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {isLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}