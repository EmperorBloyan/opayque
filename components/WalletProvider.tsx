"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Optional adapters for developer convenience
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// Wallet UI styles
import "@solana/wallet-adapter-react-ui/styles.css";

export default function AppWalletProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  // Detect network from env with safe fallback
  const network = useMemo(() => {
    const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (envNetwork === "mainnet-beta" || envNetwork === "testnet" || envNetwork === "devnet") {
      return envNetwork as WalletAdapterNetwork;
    }
    return WalletAdapterNetwork.Devnet;
  }, []);

  // Determine RPC endpoint
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(network),
    [network]
  );

  // Initialize wallets
  // If you want Wallet Standard auto-discovery, keep this empty.
  // For developer convenience, enable adapters via env flag NEXT_PUBLIC_ENABLE_ADAPTERS=true
  const wallets = useMemo(() => {
    const enableAdapters = process.env.NEXT_PUBLIC_ENABLE_ADAPTERS === "true";
    if (!enableAdapters) return [];
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      // add other adapters here if desired
    ];
  }, [network]);

  // Hardened error handler with friendly toast
  const onError = useCallback((error: WalletError) => {
    // User cancelled or rejected the request
    if (/rejected/i.test(error?.message || "") || error.name === "WalletConnectionError") {
      console.info("Opayque: Wallet connection cancelled by user.");
      setToast("Wallet connection cancelled");
      return;
    }

    // Other wallet errors
    console.error("Opayque Wallet Error:", error);
    setToast(error.message || "An unexpected wallet error occurred");
  }, []);

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={true} onError={onError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>

      {/* Global wallet toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
