"use client";

import React, { useMemo, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Load UI styles exactly once here
import "@solana/wallet-adapter-react-ui/styles.css";

export default function AppWalletProvider({ children }: { children: React.ReactNode }) {
  // 1. Detect Network from .env with a safe fallback
  const network = useMemo(() => {
    const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (envNetwork === "mainnet-beta" || envNetwork === "testnet" || envNetwork === "devnet") {
      return envNetwork as WalletAdapterNetwork;
    }
    return WalletAdapterNetwork.Devnet;
  }, []);

  // 2. Determine RPC Endpoint
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(network),
    [network]
  );

  // 3. Initialize supported wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  // 4. Hardened Error Logging for your demo
  const onError = useCallback((error: any) => {
    console.error("Opayque Wallet Adapter Error:", error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true} onError={onError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
