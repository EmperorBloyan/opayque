"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  LogIn,
  Mail,
  Upload,
  Wallet,
  Webhook,
  X,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bindAuthenticatedMerchantSession } from "@/lib/crypto/session";

const WalletMultiButtonNoSSR = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-14 w-full animate-pulse rounded-2xl bg-zinc-800/30" />
    ),
  }
);

function getRedirectTarget(defaultTarget = "/vault/registry") {
  if (typeof window === "undefined") return defaultTarget;

  const params = new URLSearchParams(window.location.search);
  const paramTarget = params.get("next")?.trim();
  const storedTarget = window.localStorage.getItem("opayque_next_route")?.trim();
  const candidate = paramTarget || storedTarget || defaultTarget;

  return candidate.startsWith("/") ? candidate : defaultTarget;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { connected, publicKey, signMessage, signTransaction } = useWallet();

  const [isNavigating, setIsNavigating] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletSigned, setWalletSigned] = useState(false);
  const [vaultReady, setVaultReady] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningWallet, setIsSigningWallet] = useState(false);
  const [isInitVault, setIsInitVault] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      setWalletAddress(publicKey.toBase58());
    }
  }, [connected, publicKey]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const goToDestination = (path: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(path);
    setTimeout(() => setIsNavigating(false), 1000);
  };

  const handleWalletSign = async () => {
    if (!publicKey || !signMessage) {
      setErrorMessage("Connect a supported wallet before continuing.");
      return;
    }

    setErrorMessage(null);
    setIsSigningWallet(true);

    try {
      const challenge = `opayque:onboarding:${Date.now()}`;
      const message = new TextEncoder().encode(challenge);
      const signature = await signMessage(message);
      const signaturePayload =
        typeof window !== "undefined"
          ? btoa(
              Array.from(signature)
                .map((byte) => String.fromCharCode(byte))
                .join("")
            )
          : "";

      setWalletAddress(publicKey.toBase58());
      setWalletSigned(Boolean(signaturePayload));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "settlement_wallet_address",
          publicKey.toBase58()
        );
        window.localStorage.setItem("wallet_signature", signaturePayload);
      }
    } catch (error) {
      console.error("Wallet signing failed", error);
      setErrorMessage(
        "Wallet signing was rejected. Please approve the message to continue."
      );
      setWalletSigned(false);
    } finally {
      setIsSigningWallet(false);
    }
  };

  /** Gasless vault init via protocol relayer */
  const handleInitVault = async () => {
    if (!publicKey || !signTransaction) {
      setErrorMessage("Connect your wallet before initializing the vault.");
      return;
    }

    setIsInitVault(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/relayer/build-initialize-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantPublicKey: publicKey.toBase58(),
          feeBps: 0,
          tokenDecimals: 6,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          text?.slice(0, 200) || "Invalid response from vault setup API"
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to build vault setup transaction"
        );
      }

      if (data.alreadyExists) {
        setVaultReady(true);
        return;
      }

      if (!data.transaction) {
        throw new Error("No transaction returned from relayer");
      }

      const txBuffer = Buffer.from(data.transaction, "base64");
      let signedTx: any;

      try {
        const { VersionedTransaction } = await import("@solana/web3.js");
        signedTx = await signTransaction(
          VersionedTransaction.deserialize(txBuffer)
        );
      } catch {
        const { Transaction } = await import("@solana/web3.js");
        signedTx = await signTransaction(Transaction.from(txBuffer));
      }

      const sig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, ...latest },
        "confirmed"
      );

      setVaultReady(true);
    } catch (e: any) {
      console.error("Vault init failed", e);
      setErrorMessage(e?.message || "Vault initialization failed");
      setVaultReady(false);
    } finally {
      setIsInitVault(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!companyName.trim()) throw new Error("Company name is required.");
      if (!walletAddress.trim()) {
        throw new Error(
          "Connect and sign with your wallet to populate the settlement address."
        );
      }
      if (!walletSigned) {
        throw new Error("Wallet signature is required before onboarding.");
      }
      if (!vaultReady) {
        throw new Error(
          "Initialize your secured vault (gasless) before creating the account."
        );
      }
      if (!email.trim() || !password.trim()) {
        throw new Error("Email and password are required.");
      }

      const supabase = createClient();
      let userId: string | null = null;

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (!signInError && signInData.user) {
        userId = signInData.user.id;
      } else {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({ email, password });

        if (signUpError) {
          const msg = String(signUpError.message || "").toLowerCase();
          if (msg.includes("already") || msg.includes("registered")) {
            throw new Error(
              "Account already exists. Please sign in with your password."
            );
          }
          throw signUpError;
        }

        userId = signUpData.user?.id ?? null;

        const { data: secondSignIn, error: secondSignInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (secondSignInError) throw secondSignInError;
        userId = secondSignIn.user?.id ?? userId;
      }

      if (!userId) throw new Error("Authentication did not create a user session.");

      const { data: upsertedMerchant, error: dbError } = await supabase
        .from("merchants")
        .upsert(
          {
            auth_user_id: userId,
            email,
            merchant_name: companyName.trim(),
            merchant_logo: logoPreview ?? null,
            settlement_wallet_address: walletAddress.trim(),
            webhook_url: webhookUrl.trim() || null,
            onboarding_status: "completed",
            api_access_status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id" }
        )
        .select()
        .single();

      if (dbError) throw dbError;

      if (upsertedMerchant?.id) {
        bindAuthenticatedMerchantSession({
          merchantId: upsertedMerchant.id,
          walletAddress:
            upsertedMerchant.settlement_wallet_address ||
            walletAddress.trim() ||
            null,
        });
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("merchant_name", companyName.trim());
        window.localStorage.setItem("merchant_email", email.trim());
        window.localStorage.setItem("merchant_logo", logoPreview || "");
        window.localStorage.setItem(
          "settlement_wallet_address",
          walletAddress.trim()
        );
        if (webhookUrl.trim()) {
          window.localStorage.setItem("webhook_url", webhookUrl.trim());
        }
        window.dispatchEvent(new Event("merchant_profile_updated"));
      }

      try {
        const merchantResponse = await fetch("/api/v1/merchant");
        if (merchantResponse.ok) {
          const merchantPayload = await merchantResponse.json();
          const merchant = merchantPayload?.merchant;
          if (merchant?.id) {
            bindAuthenticatedMerchantSession({
              merchantId: merchant.id,
              walletAddress: merchant.settlement_wallet_address || null,
            });
          }
          if (merchant?.merchant_name) {
            window.localStorage.setItem(
              "merchant_name",
              merchant.merchant_name
            );
          }
          if (merchant?.merchant_logo) {
            window.localStorage.setItem(
              "merchant_logo",
              merchant.merchant_logo
            );
          }
        }
      } catch {
        // non-blocking
      }

      const destination = getRedirectTarget("/vault/registry");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("opayque_next_route", destination);
      }
      router.push(destination);
    } catch (error: any) {
      console.error("Onboarding failed:", error);
      setErrorMessage(
        error?.message || "Failed to create account. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.10),transparent_40%)] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.10),transparent_45%)] pointer-events-none -z-10" />

      <button
        type="button"
        onClick={() => goToDestination("/")}
        disabled={isNavigating}
        className="absolute top-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-900/50 text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Return to home"
      >
        <X size={24} />
      </button>

      <div className="relative z-10 my-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-[2.5rem] border border-white/10 bg-[#0a0a0c]/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.1)] backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="group relative mb-6">
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-purple-500/50 bg-purple-500/10 transition-all hover:border-purple-400 hover:bg-purple-500/20">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-purple-400 transition-transform group-hover:scale-110" />
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

            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Secure Developer Access
            </p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
              Set up your control center
            </h1>
            <p className="mt-2 text-xs text-zinc-400">
              Connect wallet, sign ownership, initialize gasless vault, then create
              your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Company Name
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 transition-colors focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Building2 className="h-4 w-4" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Opayque Inc."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </label>

            <div className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Wallet Address
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 transition-colors focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Wallet className="h-4 w-4 shrink-0" />
                  <div className="w-full min-h-[44px]">
                    {connected ? (
                      <div className="flex flex-col gap-2">
                        <span className="truncate text-sm text-white">
                          {walletAddress ||
                            publicKey?.toBase58() ||
                            "Wallet connected"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleWalletSign()}
                            disabled={isSigningWallet}
                            className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-purple-200 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSigningWallet
                              ? "Signing..."
                              : walletSigned
                                ? "Wallet signed"
                                : "Select Wallet & Sign"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleInitVault()}
                            disabled={isInitVault || !connected}
                            className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Shield className="h-3 w-3" />
                            {isInitVault
                              ? "Initializing..."
                              : vaultReady
                                ? "Vault ready"
                                : "Initialize Vault (gasless)"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <WalletMultiButtonNoSSR className="!h-11 !w-full !rounded-xl !bg-white !text-black !text-[10px] !font-black !uppercase !tracking-[0.2em] hover:!bg-zinc-200" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-1 flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <div className="flex items-center gap-2">
                {walletSigned ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-400" />
                )}
                <span>
                  {walletSigned
                    ? "Settlement wallet signed and verified"
                    : "Wallet must be connected and signed"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {vaultReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Lock className="h-4 w-4 text-amber-400" />
                )}
                <span>
                  {vaultReady
                    ? "Secured vault initialized (gasless)"
                    : "Vault must be initialized before account creation"}
                </span>
              </div>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Webhook URL
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 transition-colors focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Webhook className="h-4 w-4" />
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="https://your-api.com/webhooks"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </label>

            <div className="h-px w-full bg-white/5" />

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Admin Email Address
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 transition-colors focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Mail className="h-4 w-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </label>

            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              Password
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 transition-colors focus-within:border-purple-500/60">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Lock className="h-4 w-4" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </label>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                <p className="text-xs font-medium text-rose-400">
                  {errorMessage}
                </p>
              </div>
            )}

            <div className="pt-4 text-center">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    goToDestination(
                      `/login?next=${encodeURIComponent(
                        getRedirectTarget("/vault/registry")
                      )}`
                    )
                  }
                  disabled={isNavigating}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-300 transition hover:bg-white/10 hover:text-white sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Already have an account? Sign In</span>
                </button>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    isNavigating ||
                    !walletSigned ||
                    !vaultReady
                  }
                  className="flex w-full flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-purple-500/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <span>{isLoading ? "Setting up..." : "Create Account"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-6 px-4 text-[10px] leading-relaxed text-zinc-500">
                By setting up your control center, you agree to manage your
                developer workspace and billing settings through Opayque.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}