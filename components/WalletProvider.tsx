"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Import styles once here to ensure they load
import "@solana/wallet-adapter-react-ui/styles.css";

export default function WalletProviderWrapper({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  // 1. Network Setup
  const network = useMemo(() => {
    const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (envNetwork === "mainnet-beta" || envNetwork === "testnet" || envNetwork === "devnet") {
      return envNetwork as WalletAdapterNetwork;
    }
    return WalletAdapterNetwork.Devnet;
  }, []);

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(network),
    [network]
  );

  // 2. Wallets (Auto-discovery mode for better performance)
  const wallets = useMemo(() => [], []);

  // 3. Error Handling (The "Shield")
  const onError = useCallback((error: WalletError) => {
    if (/rejected/i.test(error?.message || "") || error.name === "WalletConnectionError") {
      setToast("Wallet connection cancelled");
      return;
    }
    console.error("Opayque Wallet Error:", error);
    setToast(error.message || "An unexpected wallet error occurred");
  }, []);

  // 4. Toast Cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>

      {/* Global Toast for Errors */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </ConnectionProvider>
  );
}
