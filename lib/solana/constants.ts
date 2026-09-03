import { PublicKey } from "@solana/web3.js";

export const SOLANA_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";
export const SOLANA_TESTNET_RPC = "https://api.testnet.solana.com";

export type SolanaNetwork = "mainnet-beta" | "testnet" | "devnet";

export interface SolanaNetworkConfig {
  network: SolanaNetwork;
  rpcUrls: string[];
  isMainnet: boolean;
  isSandbox: boolean;
}

export function getSolanaNetwork(): SolanaNetwork {
  const configured = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (configured === "mainnet-beta" || configured === "testnet" || configured === "devnet") {
    return configured;
  }
  return "devnet";
}

export function getSolanaRpcUrl(): string {
  return getSolanaRpcUrls()[0];
}

export function getSolanaRpcUrls(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACK_URL,
  ].map((url) => url?.trim()).filter((url): url is string => Boolean(url));
  if (configured.length > 0) return [...new Set(configured)];

  const network = getSolanaNetwork();
  return [network === "mainnet-beta" ? SOLANA_MAINNET_RPC : network === "testnet" ? SOLANA_TESTNET_RPC : SOLANA_DEVNET_RPC];
}

export interface ProductionConfigIssue {
  key: string;
  message: string;
}

export function getProductionConfigIssues(): ProductionConfigIssue[] {
  if (process.env.NODE_ENV !== "production" || !isMainnetNetwork()) return [];

  const issues: ProductionConfigIssue[] = [];
  if (!process.env.NEXT_PUBLIC_RPC_URL?.trim() && !process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()) {
    issues.push({ key: "NEXT_PUBLIC_RPC_URL", message: "A dedicated mainnet RPC URL is required" });
  }
  if (!process.env.NEXT_PUBLIC_MAGICBLOCK_API?.trim()) {
    issues.push({ key: "NEXT_PUBLIC_MAGICBLOCK_API", message: "MagicBlock private transfer API is required" });
  }
  if (!process.env.MAGICBLOCK_API_KEY?.trim()) {
    issues.push({ key: "MAGICBLOCK_API_KEY", message: "MagicBlock API authentication is required" });
  }
  if (!process.env.RELAYER_PRIVATE_KEY?.trim()) {
    issues.push({ key: "RELAYER_PRIVATE_KEY", message: "Relayer signing key is required" });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    issues.push({ key: "SUPABASE_SERVICE_ROLE_KEY", message: "Server-side Supabase configuration is required" });
  }
  return issues;
}

export function assertProductionConfig(): void {
  const issues = getProductionConfigIssues();
  if (issues.length > 0) {
    throw new Error(`Production configuration is incomplete: ${issues.map((issue) => issue.message).join("; ")}`);
  }
}

export function isDevnetNetwork(): boolean {
  return getSolanaNetwork() !== "mainnet-beta";
}

export function isMainnetNetwork(): boolean {
  return getSolanaNetwork() === "mainnet-beta";
}

export function getSolanaNetworkConfig(): SolanaNetworkConfig {
  const network = getSolanaNetwork();
  return {
    network,
    rpcUrls: getSolanaRpcUrls(),
    isMainnet: network === "mainnet-beta",
    isSandbox: network !== "mainnet-beta",
  };
}

export interface AssetMintConfig {
  symbol: string;
  mainnet: string;
  devnet: string;
  decimals: number;
  isNative?: boolean;
}

export const ASSET_MINTS: Record<string, AssetMintConfig> = {
  USDC: {
    symbol: "USDC",
    mainnet: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    mainnet: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    devnet: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    decimals: 6,
  },
  SOL: {
    symbol: "SOL",
    mainnet: "So11111111111111111111111111111111111111112",
    devnet: "So11111111111111111111111111111111111111112",
    decimals: 9,
    isNative: true,
  },
};

export const OPAYQUE_VAULT_MAINNET = new PublicKey("9RZ8jZ7sRjqTQf2v8QEaNwXm7fXb3jM5B8zV3mR2A1d2");
export const OPAYQUE_VAULT_DEVNET = new PublicKey("6U2Tb5TAz8D7JwA8mD2U5z3pNr9uJQ2xyy8m3H3D8sss");
export const OPAYQUE_ESCROW_MAINNET = new PublicKey("4u2vJ4G4P5mH8C4YJ2f8r5k2h9A8g2f4b2t9Jf3D4x2Q");
export const OPAYQUE_ESCROW_DEVNET = new PublicKey("3rQ9b4N2wPKnSLsLQ8G8x4TRV6C4c4tAKgJw8mYdE4iV");
export const OPAYQUE_OUSD_MINT_MAINNET = new PublicKey("9XQyAfh5v6d73R8hJj2yL4dQfM2w1hM6yG7fC9GmL8dA");
export const OPAYQUE_OUSD_MINT_DEVNET = new PublicKey("3x6J7YgQf4hYQ7tJ4mJ3nR1sV3L5kYbD4f8JqP8D7sV2");
export const OPAYQUE_OSOL_MINT_MAINNET = new PublicKey("5wM9LfWqVx7dA3vH9S5AqQ2wG6Y8sP4xT7dD7Q4J4Jr8");
export const OPAYQUE_OSOL_MINT_DEVNET = new PublicKey("8k3J8R1kX6h4uJ4fU4v3vQ9D2W6g2fK7mW5wD7H2s6A");

export function getAssetMintAddress(symbol: keyof typeof ASSET_MINTS, isDevnet: boolean): string {
  const config = ASSET_MINTS[symbol];
  if (!config) {
    throw new Error(`Unsupported asset ${symbol}`);
  }

  return isDevnet ? config.devnet : config.mainnet;
}
