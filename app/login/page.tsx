'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Lock, Mail, UserPlus, ArrowRight } from 'lucide-react';

const authModes = ['signIn', 'signUp'] as const;

type AuthMode = (typeof authModes)[number];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useMagicLink, setUseMagicLink] = useState(false);

  const title = mode === 'signIn' ? 'Sign in to Opayque' : 'Create an account';
  const buttonLabel = useMagicLink
    ? mode === 'signIn'
      ? 'Send Magic Link'
      : 'Send Signup Link'
    : mode === 'signIn'
    ? 'Sign In'
    : 'Create Account';

  const infoText = useMemo(() => {
    if (useMagicLink) {
      return 'Enter your email and we’ll send you a secure link to complete login.';
    }
    return mode === 'signIn'
      ? 'Enter your email and password to access your developer dashboard.'
      : 'Create a new Opayque account with email and password.';
  }, [mode, useMagicLink]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      if (useMagicLink) {
        const { error: signInError } = await supabase.auth.signInWithOtp({ email });
        if (signInError) throw signInError;
        setMessage('Magic link sent to your inbox. Check email to continue.');
        return;
      }

      if (mode === 'signUp') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data?.user) {
          router.push('/developer/overview');
          return;
        }
        setMessage('Check your email to confirm your account before signing in.');
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (data?.user) {
        router.push('/developer/overview');
      } else {
        setMessage('Signed in successfully. Redirecting…');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-white/10 bg-[#0b0c10]/90 p-8 shadow-2xl shadow-purple-900/10 backdrop-blur-xl">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-purple-600/10 text-purple-300 border border-purple-500/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-zinc-500">Secure Developer Login</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{infoText}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-3xl bg-[#08090f] p-1 text-xs uppercase tracking-[0.3em] text-zinc-400">
          {authModes.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={`rounded-3xl py-3 transition ${mode === tab ? 'bg-purple-600/80 text-white shadow-lg shadow-purple-500/20' : 'hover:bg-white/5'}`}
            >
              {tab === 'signIn' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
            Email address
            <div className="mt-2 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
              <div className="flex items-center gap-3 text-zinc-400">
                <Mail className="h-4 w-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                  required
                />
              </div>
            </div>
          </label>

          {!useMagicLink && (
            <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400">
              Password
              <div className="mt-2 rounded-3xl border border-white/10 bg-[#050508] px-4 py-3 focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Lock className="h-4 w-4" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
                    required
                  />
                </div>
              </div>
            </label>
          )}

          <div className="flex items-center justify-between gap-3 text-sm text-zinc-400">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useMagicLink}
                onChange={() => setUseMagicLink((current) => !current)}
                className="h-4 w-4 rounded border-white/20 bg-[#050508] text-purple-500 accent-purple-500"
              />
              Magic link only
            </label>
            <button
              type="button"
              onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
              className="text-purple-300 hover:text-purple-100"
            >
              {mode === 'signIn' ? 'Create account' : 'Have an account?'}
            </button>
          </div>

          {error && <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {message && <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-purple-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{isLoading ? 'Processing…' : buttonLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#08090f]/80 p-4 text-center text-sm text-zinc-500">
          By signing in, you agree to manage your developer workspace and billing settings through Opayque.
        </div>
      </div>
    </div>
  );
}
