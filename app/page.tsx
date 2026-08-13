"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  LucideShieldCheck, 
  LucideLoader2, 
  LucideLock, 
  LucideMonitorSmartphone, 
  LucideCode2 
} from "lucide-react";
import { clearActiveSession, createSessionChallenge, createTerminalSession, getActiveSession, setActiveSession } from "@/lib/crypto/session";
import { configureConfidentialAccount } from "@/lib/solana/confidential";
import { getAssetMintAddress } from "@/lib/solana/constants";
import { PublicKey } from "@solana/web3.js";

function getSavedMerchantName() {
  if (typeof window === "undefined") {
    return "Opayque Merchant";
  }

  const merchantName = window.localStorage.getItem("merchant_name")?.trim();
  return merchantName || "Opayque Merchant";
}

function getSavedMerchantLogo() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("merchant_logo")?.trim() || window.localStorage.getItem("merchant_avatar")?.trim() || null;
}

async function registerMerchant(walletAddress: string): Promise<string> {
  const response = await fetch("/api/merchant/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: walletAddress,
      merchant_name: getSavedMerchantName(),
      merchant_logo: getSavedMerchantLogo(),
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success || !payload?.data?.merchant?.id) {
    throw new Error(payload?.error || "Failed to register merchant");
  }

  return payload.data.merchant.id;
}

const WalletMultiButtonNoSSR = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  {
    ssr: false,
    loading: () => <div className="h-14 w-full bg-zinc-800/20 animate-pulse rounded-2xl" />,
  }
);

function getMobileWalletContext() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isMobile: false, isInAppBrowser: false };
  }

  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isInAppBrowser = /Instagram|FBAN|FBAV|Line|TikTok|Twitter|Discord|WeChat|WhatsApp|Telegram|KAKAOTALK|Meta|FxiOS|CriOS|SamsungBrowser|FB_IAB|FB4A/i.test(ua);
  const isStandalone = Boolean((window as Window & { navigator?: { standalone?: boolean } }).navigator?.standalone);

  return {
    isMobile,
    isInAppBrowser: isInAppBrowser || isStandalone,
  };
}

function openPhantomUniversalLink(targetUrl: string) {
  if (typeof window === "undefined") {
    return;
  }

  const phantomUrl = `https://phantom.app/ul/browse/${encodeURIComponent(targetUrl)}`;
  const popup = window.open(phantomUrl, "_blank", "noopener,noreferrer");

  if (!popup) {
    window.location.assign(phantomUrl);
  }
}

export default function UnifiedLanding() {
  const [mounted, setMounted] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { connected, publicKey, signMessage, signTransaction, signAndSendTransaction, connect } = useWallet();
  const router = useRouter();
  const mobileWalletContext = getMobileWalletContext();

  useEffect(() => {
    setMounted(true);
    if (getActiveSession()) {
      setIsAuthorizing(true);
    }
  }, []);

  const handleVaultEntrance = async () => {
    const canSignMessage = Boolean(signMessage);
    const canSignTransaction = Boolean(signTransaction || signAndSendTransaction);
    const canPerformConfidentialSetup = canSignMessage || canSignTransaction;

    if (!connected || !publicKey) {
      if (mobileWalletContext.isMobile && !mobileWalletContext.isInAppBrowser) {
        setAuthError("Opening Phantom for a seamless mobile sign-in...");
        openPhantomUniversalLink(window.location.href);
        return;
      }

      if (connect) {
        try {
          await connect();
        } catch (e) {
          setAuthError("Please connect a wallet to continue.");
          return;
        }
      } else {
        setAuthError("Please connect a wallet to continue.");
        return;
      }
    }

    if (!publicKey || !canPerformConfidentialSetup) {
      if (mobileWalletContext.isMobile && !mobileWalletContext.isInAppBrowser) {
        setAuthError("Phantom is required for secure mobile signing. Opening Phantom...");
        openPhantomUniversalLink(window.location.href);
        return;
      }

      setAuthError("Connected wallet cannot perform confidential signing operations. Please use Phantom or another supported wallet.");
      return;
    }

    setAuthError(null);
    setIsAuthorizing(true);

    try {
      const merchantId = await registerMerchant(publicKey.toBase58());
      const challenge = createSessionChallenge();
      const message = new TextEncoder().encode(challenge.nonce);
      const signature = canSignMessage ? await signMessage(message) : new Uint8Array();
      const session = await createTerminalSession({
        merchantId,
        walletAddress: publicKey.toBase58(),
        nonce: challenge.nonce,
        walletSignature: signature,
      });

      const mint = new PublicKey(getAssetMintAddress("USDC", true));
      const confidentialSummary = await configureConfidentialAccount(
        { publicKey, signMessage, signTransaction, signAndSendTransaction },
        mint
      );

      if (confidentialSummary.status === "unsupported" || confidentialSummary.status === "error") {
        setActiveSession(session);
        setAuthError(confidentialSummary.message);
        router.push("/vault/registry");
        return;
      }

      setActiveSession(session);
      router.push("/vault/registry");
    } catch (error) {
      clearActiveSession();
      setIsAuthorizing(false);
      setAuthError(error instanceof Error ? error.message : "Wallet signing was rejected.");
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {isAuthorizing && (
        <div className="absolute inset-0 bg-purple-600/15 animate-pulse duration-400 z-0" />
      )}

      {isAuthorizing ? (
        <div className="z-20 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 rounded-full border border-purple-500/30 flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500 animate-ping opacity-20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin duration-700" />
            <LucideShieldCheck size={32} className="text-purple-500" />
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Merchant Authorization</h2>
          <div className="flex items-center gap-3 text-zinc-500">
            <LucideLoader2 size={14} className="animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Verifying Shielded Identity...</p>
          </div>
          {authError ? (
            <p className="mt-4 max-w-sm text-sm text-amber-400">{authError}</p>
          ) : null}
        </div>
      ) : (
        <div className="z-10 w-full max-w-4xl animate-in fade-in duration-700">
          <header className="text-center mb-16">
            <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2">Opayque</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-[0.5em] font-bold">
              Shielded POS Infrastructure
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CARD 1: MERCHANT VAULT */}
            <div className="group relative bg-zinc-900 border border-white/5 p-10 rounded-[3.5rem] transition-all hover:border-purple-500/30 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-black italic uppercase">Merchant Vault</h2>
                  <LucideLock className="text-zinc-700" size={20} />
                </div>
                <p className="text-zinc-500 text-sm mb-12 h-12">
                  Manage staff, pair terminals, and audit transactions via TEE-shielded protocols.
                </p>
              </div>

              {connected ? (
                <button
                  onClick={() => void handleVaultEntrance()}
                  className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition-all active:scale-[0.98]"
                >
                  Enter Secured Vault
                </button>
              ) : (
                <div className="p-1 bg-gradient-to-b from-white/10 to-transparent rounded-2xl">
                  <WalletMultiButtonNoSSR className="!bg-white !text-black !rounded-xl !font-black !text-[10px] !uppercase !tracking-widest !h-14 !w-full flex justify-center hover:!bg-zinc-200" />
                </div>
              )}
              {authError ? <p className="mt-4 text-sm text-amber-400">{authError}</p> : null}
            </div>

            {/* CARD 2: STAFF TERMINAL */}
            <Link
              href="/terminal"
              className="group relative bg-zinc-900/50 border border-white/5 p-10 rounded-[3.5rem] transition-all hover:bg-zinc-900 hover:border-white/10 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-black italic uppercase text-zinc-400 group-hover:text-white transition-colors">
                    Staff Terminal
                  </h2>
                  <LucideMonitorSmartphone className="text-zinc-700" size={20} />
                </div>
                <p className="text-zinc-500 text-sm mb-12 h-12">
                  Launch the hardware interface for point-of-sale operations.
                </p>
              </div>
              <span className="block w-full py-5 bg-zinc-800 text-white text-center rounded-2xl font-black uppercase text-xs tracking-widest group-hover:bg-zinc-700 transition-all">
                Open Terminal
              </span>
            </Link>

            {/* CARD 3: API & DEVELOPERS (UNIFIED DESIGN) */}
            <div className="group relative bg-zinc-900/50 border border-white/5 p-10 rounded-[3.5rem] transition-all hover:bg-zinc-900 hover:border-white/10 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-black italic uppercase text-zinc-400 group-hover:text-white transition-colors">
                    API & Developers
                  </h2>
                  <LucideCode2 className="text-zinc-700" size={20} />
                </div>
                <p className="text-zinc-500 text-sm mb-12 h-12">
                  Manage API keys, configure live webhooks, and integrate custom payment platforms.
                </p>
              </div>

              <div className="flex gap-3">
                <Link href="/developer/overview" className="flex-1">
                  <button className="w-full py-5 bg-zinc-800 text-white text-center rounded-2xl font-black uppercase text-xs tracking-widest group-hover:bg-zinc-700 transition-all">
                    Dashboard
                  </button>
                </Link>
                <Link href="/developer/docs" className="flex-1">
                  <button className="w-full py-5 border border-white/10 text-zinc-300 text-center rounded-2xl font-black uppercase text-xs tracking-widest hover:border-white/20 hover:text-white transition-all">
                    Docs
                  </button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}

      <footer className="absolute bottom-10 opacity-20">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-500">Global Settlement Layer</span>
          <p className="text-[9px] font-mono uppercase tracking-widest">Built for Solana Radar 2026</p>
        </div>
      </footer>

      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none opacity-10" />
    </div>
  );
}
