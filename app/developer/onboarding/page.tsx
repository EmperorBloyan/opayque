"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  X, 
  Upload, 
  Building2, 
  Wallet, 
  Webhook, 
  Mail, 
  Lock, 
  ArrowRight,
  LogIn
} from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function DeveloperOnboardingPage() {
  const router = useRouter();
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null); // Clear any previous errors

    try {
      const supabase = createClient();
      
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Link the merchant record to the authenticated Supabase user.
      // The API profile fetch looks up merchants by auth_user_id, not by id.
      if (authData.user) {
        const { error: dbError } = await supabase
          .from('merchants')
          .upsert({
            auth_user_id: authData.user.id,
            email,
            merchant_name: companyName,
            settlement_wallet_address: walletAddress,
            webhook_url: webhookUrl,
            onboarding_status: 'completed'
          }, { onConflict: 'auth_user_id' })
          .select();

        if (dbError) throw dbError;
      }

      // 3. Save local branding & config for immediate zero-latency UI hydration
      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_name", companyName);
        window.localStorage.setItem("merchant_email", email);
        window.localStorage.setItem("settlement_wallet_address", walletAddress);
        if (webhookUrl) window.localStorage.setItem("webhook_url", webhookUrl);
        if (logoPreview) window.localStorage.setItem("merchant_logo", logoPreview);
      }
      
      // 4. Redirect to the login page so they can sign in with their new credentials
      router.push("/login");

    } catch (error: any) {
      console.error("Signup failed:", error.message);
      setErrorMessage(error.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.10),transparent_40%)] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.10),transparent_45%)] pointer-events-none -z-10" />

      {/* Close Button at the top */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 right-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-white/10 hover:text-white transition-all z-50"
        aria-label="Return to home"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500 my-10">
        <div className="rounded-[2.5rem] border border-white/10 bg-[#0a0a0c]/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.1)] backdrop-blur-xl">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative group mb-6">
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-purple-500/50 bg-purple-500/10 transition-all hover:bg-purple-500/20 hover:border-purple-400 overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company Logo" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
              </label>
              {!logoPreview && (
                <span className="absolute -bottom-6 left-1/2 w-max -translate-x-1/2 text-[9px] uppercase tracking-widest text-zinc-500">
                  Upload Logo
                </span>
              )}
            </div>

            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-4">Secure Developer Access</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Set up your control center</h1>
            <p className="mt-2 text-xs text-zinc-400">Configure your merchant workspace to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Company Name
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 focus-within:border-purple-500/60 transition-colors">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Building2 className="h-4 w-4" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Opayque Inc."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </label>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Destination Wallet Address
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 focus-within:border-purple-500/60 transition-colors">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Wallet className="h-4 w-4" />
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </label>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Webhook URL
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 focus-within:border-purple-500/60 transition-colors">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Webhook className="h-4 w-4" />
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-api.com/webhooks"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </label>

            <div className="h-px w-full bg-white/5 my-2"></div>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Admin Email Address
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 focus-within:border-purple-500/60 transition-colors">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Mail className="h-4 w-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </label>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Password
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 focus-within:border-purple-500/60 transition-colors">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Lock className="h-4 w-4" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </label>

            {errorMessage && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-center border border-rose-500/20">
                <p className="text-xs text-rose-400 font-medium">{errorMessage}</p>
              </div>
            )}

            <div className="pt-4 text-center">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Sign In Link */}
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-300 transition hover:bg-white/10 hover:text-white w-full sm:w-auto"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </Link>

                {/* Submit Form Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex flex-1 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{isLoading ? "Setting up..." : "Create Account"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              
              <p className="mt-6 text-[10px] leading-relaxed text-zinc-500 px-4">
                By setting up your control center, you agree to manage your developer workspace and billing settings through Opayque.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
