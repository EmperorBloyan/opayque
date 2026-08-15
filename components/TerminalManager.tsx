"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { 
  LucideBell, 
  LucideHardDrive, 
  LucidePlus, 
  LucideRefreshCw, 
  LucideTrash2, 
  LucideAlertTriangle, 
  LucideHome 
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getActiveSession, getStoredMerchantId } from "@/lib/crypto/session";
import { ASSET_MINTS, getAssetMintAddress } from "@/lib/solana/constants";
import { sendJitoBundle } from "@/lib/solana/jito";
import type { Terminal } from "@/lib/types";
import PairingModal from "./PairingModal";
import "@solana/wallet-adapter-react-ui/styles.css";

const JITO_TIP_ACCOUNT = new PublicKey("96gYZGLnJYVFmbjzopA9f848uwF32vRkeXaE4W36fT23");
const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_INSTRUCTIONS_URL = "https://quote-api.jup.ag/v6/swap-instructions";

interface TerminalManagerProps {
  terminals?: Terminal[];
  setTerminals?: React.Dispatch<React.SetStateAction<Terminal[]>>;
  showHeaderInput?: boolean;
  amount?: number;
  merchantWallet?: string;
  sessionId?: string;
  currency?: string;
  onSuccess?: () => void;
}

interface TokenBalance {
  mint: string;
  symbol: string;
  decimals: number;
  uiAmount: number;
  baseUnits: bigint;
}

function createAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createDefaultTerminalLabel() {
  const shortId = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `Terminal-${shortId}`;
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseHumanAmountToBaseUnits(amount: number, decimals: number): bigint {
  const amountString = amount.toString();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountString)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = amountString.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places`);
  }

  const normalizedFraction = fraction.padEnd(decimals, '0');
  return BigInt(whole + normalizedFraction);
}

function formatBaseUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const fractionString = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fractionString.length > 0 ? `${whole.toString()}.${fractionString}` : whole.toString();
}

function toBase64(bytes: Uint8Array): string {
  if (typeof window !== "undefined" && window.btoa) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

function fromBase64(base64: string): Uint8Array {
  if (typeof window !== "undefined" && window.atob) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function getTokenSymbol(mint: string, networkIsDevnet: boolean) {
  if (mint === getAssetMintAddress("SOL" as any, networkIsDevnet)) return "SOL";
  if (mint === getAssetMintAddress("USDC" as any, networkIsDevnet)) return "USDC";
  if (mint.toString() === "DezXAZ8z7PnrnRJjzJgV16bYXu5G6oZ6Kk4pHZh4AtM") return "BONK";
  return mint.slice(0, 4).toUpperCase();
}

function resolveUsdcDestinationAccount(connection: any, merchantWallet: string, mint: PublicKey) {
  const candidate = new PublicKey(merchantWallet);
  return connection.getAccountInfo(candidate)
    .then((accountInfo: any) => {
      if (accountInfo?.owner?.equals?.(TOKEN_PROGRAM_ID)) {
        return candidate;
      }
      return getAssociatedTokenAddress(mint, candidate, false);
    })
    .catch(() => getAssociatedTokenAddress(mint, candidate, false));
}

async function resolveMerchantId(): Promise<string | null> {
  const storedMerchantId = getStoredMerchantId();
  if (storedMerchantId && isValidUuid(storedMerchantId)) {
    return storedMerchantId;
  }

  const session = getActiveSession();
  if (session?.merchantId && isValidUuid(session.merchantId)) {
    return session.merchantId;
  }

  if (!session?.walletAddress) {
    return null;
  }

  const supabase = createSupabaseBrowserClient();
  const { data: existingMerchant, error: fetchError } = await supabase
    .from("merchants")
    .select("id")
    .eq("wallet_address", session.walletAddress)
    .single();

  if (!fetchError && existingMerchant?.id) {
    return existingMerchant.id;
  }

  const merchantName = typeof window !== "undefined"
    ? window.localStorage.getItem("merchant_name")?.trim() || "Opayque Merchant"
    : "Opayque Merchant";

  const { data: insertedMerchant, error: insertError } = await supabase
    .from("merchants")
    .upsert({ wallet_address: session.walletAddress, merchant_name: merchantName }, { onConflict: "wallet_address" })
    .select()
    .single();

  if (insertError || !insertedMerchant?.id) {
    console.error("Failed to resolve or create merchant record", insertError);
    return null;
  }

  return insertedMerchant.id;
}

async function ensureActiveMerchantWalletRecord(): Promise<{ merchantId: string | null; walletAddress: string | null }> {
  const session = getActiveSession();
  const walletAddress = session?.walletAddress?.trim() || null;

  if (!walletAddress) {
    return { merchantId: null, walletAddress: null };
  }

  const supabase = createSupabaseBrowserClient();
  const merchantName = typeof window !== "undefined"
    ? window.localStorage.getItem("merchant_name")?.trim() || "Opayque Merchant"
    : "Opayque Merchant";

  const { data, error } = await supabase
    .from("merchants")
    .upsert({ wallet_address: walletAddress, merchant_name: merchantName }, { onConflict: "wallet_address" })
    .select("id, wallet_address")
    .single();

  if (error || !data?.id) {
    console.error("Failed to persist active merchant wallet record", error);
    return { merchantId: null, walletAddress: walletAddress };
  }

  return { merchantId: data.id, walletAddress: data.wallet_address ?? walletAddress };
}

function normalizeTerminals(items: Terminal[] = []): Terminal[] {
  return items.map((terminal) => ({
    ...terminal,
    status: terminal.status ?? "online",
    lastSeen: terminal.lastSeen ?? Date.now(),
    accessCode: terminal.accessCode ?? createAccessCode(),
    isActive: Boolean(terminal.isActive),
    lastLoginAt: terminal.lastLoginAt ?? null,
  }));
}

export default function TerminalManager({
  terminals = [],
  setTerminals,
  showHeaderInput = true,
  amount,
  merchantWallet,
  sessionId,
  currency = "USDC",
  onSuccess,
}: TerminalManagerProps) {
  const router = useRouter();
  const safeTerminals = normalizeTerminals(terminals);
  const [resolvedMerchantId, setResolvedMerchantId] = useState<string | null>(null);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [timeLeft, setTimeLeft] = useState("10M 00S");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);
  const [newTerminalLabel, setNewTerminalLabel] = useState("");
  const [pairingState, setPairingState] = useState<"idle" | "waiting" | "used">("idle");
  const [toast, setToast] = useState<string | null>(null);
  
  // Balances and Checkout State
  const [solBalance, setSolBalance] = useState<bigint>(0n);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedTokenMint, setSelectedTokenMint] = useState<string | null>(null);
  const [quoteInputAmount, setQuoteInputAmount] = useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Runtime Error Recovery State
  const [errorState, setErrorState] = useState<{
    message: string;
    step?: string;
  } | null>(null);

  const fleetChannelRef = useRef<any | null>(null);

  const { publicKey, signTransaction, signAndSendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const networkIsDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta";
  const usdcMintAddress = getAssetMintAddress("USDC" as any, networkIsDevnet);
  const solMintAddress = getAssetMintAddress("SOL" as any, networkIsDevnet);
  const isCheckoutMode = typeof amount === "number" && amount > 0 && Boolean(merchantWallet) && Boolean(sessionId);

  // --- PERSIST / LOAD TERMINALS ---
  const persistTerminals = useCallback(
    async (updated: Terminal[]) => {
      if (setTerminals) {
        setTerminals(updated);
      }
    },
    [setTerminals]
  );

  const loadFromSupabase = useCallback(async () => {
    if (!resolvedMerchantId) return;
    setIsLoadingTerminals(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("terminals")
        .select("*")
        .eq("merchant_id", resolvedMerchantId)
        .order("last_active", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: Terminal[] = data.map((row: any) => ({
          id: row.id,
          label: row.terminal_label || row.label || "Terminal Node",
          status: row.status === "online" ? "online" : "offline",
          lastSeen: row.last_active ? new Date(row.last_active).getTime() : Date.now(),
          accessCode: row.device_token || row.access_code || createAccessCode(),
          isActive: row.status === "online" || Boolean(row.is_active),
          lastLoginAt: row.last_active ? new Date(row.last_active).getTime() : null,
        }));
        await persistTerminals(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load terminals from Supabase", err);
    } finally {
      setIsLoadingTerminals(false);
    }
  }, [persistTerminals, resolvedMerchantId]);

  // --- REFACTORED PAIRING CODE GENERATION ---
  const refreshAuthCode = useCallback(
    async (labelOverride?: string) => {
      const merchantWalletRecord = await ensureActiveMerchantWalletRecord();
      const merchantIdForPairing = resolvedMerchantId ?? merchantWalletRecord.merchantId;
      const walletAddressForPairing = merchantWalletRecord.walletAddress;

      if (!merchantIdForPairing || merchantIdForPairing === "merchant-vault") {
        setToast("Merchant wallet not linked. Complete vault authorization first.");
        setTimeout(() => setToast(null), 3000);
        return;
      }

      if (!isValidUuid(merchantIdForPairing)) {
        setToast("Invalid merchant context. Please re-authorize.");
        setTimeout(() => setToast(null), 3000);
        return;
      }

      setResolvedMerchantId(merchantIdForPairing);
      setIsRefreshingCode(true);
      setErrorState(null);

      try {
        const terminalLabel = labelOverride || newTerminalLabel || createDefaultTerminalLabel();

        // Call API to create pairing code - this validates merchant and patches wallet_address
        const response = await fetch("/api/terminal/pairing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            merchant_id: merchantIdForPairing,
            wallet_address: walletAddressForPairing,
            terminal_label: terminalLabel,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to create pairing code");
        }

        // Only reveal the code after server validation succeeds
        setAuthCode(result.code);
        const expiresAtMs = new Date(result.expiresAt).getTime();
        setPairingExpiresAt(expiresAtMs);
        setPairingState("waiting");
      } catch (err: any) {
        console.error("Failed to generate pairing code:", err);
        setToast(err.message || "Failed to create code. Try again.");
        setTimeout(() => setToast(null), 3000);
        setAuthCode("ERROR");
        setTimeLeft("00M 00S");
      } finally {
        setIsRefreshingCode(false);
      }
    },
    [newTerminalLabel, resolvedMerchantId]
  );

  // TIMER HANDLER
  useEffect(() => {
    if (!pairingExpiresAt || !isPairingOpen) return;

    const tick = () => {
      const diff = pairingExpiresAt - Date.now();
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        return false;
      }
      
      const totalSeconds = Math.floor(diff / 1000);
      const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      
      setTimeLeft(`${m}M ${s}S`);
      return true;
    };

    tick();
    const interval = setInterval(() => {
      if (!tick()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pairingExpiresAt, isPairingOpen]);

  const closePairingModal = () => {
    setIsPairingOpen(false);
    setPairingState("idle");
  };

  const expectedUsdcBaseUnits = useMemo(() => {
    if (!amount || Number.isNaN(amount)) return 0n;
    try {
      return parseHumanAmountToBaseUnits(amount, ASSET_MINTS.USDC.decimals);
    } catch {
      return 0n;
    }
  }, [amount]);

  const usdcBalance = useMemo(() => {
    return tokenBalances.find((token) => token.mint === usdcMintAddress) ?? null;
  }, [tokenBalances, usdcMintAddress]);

  const usdcBalanceSufficient = usdcBalance?.baseUnits !== undefined && usdcBalance.baseUnits >= expectedUsdcBaseUnits;

  const availableSwapTokens = useMemo(() => {
    return tokenBalances.filter((token) => token.mint !== usdcMintAddress && token.baseUnits > 0n);
  }, [tokenBalances, usdcMintAddress]);

  const selectedBalance = useMemo(() => {
    if (!selectedTokenMint) return null;
    return tokenBalances.find((token) => token.mint === selectedTokenMint) ?? null;
  }, [selectedTokenMint, tokenBalances]);

  const parsedUsdcBalance = useMemo(() => {
    if (!usdcBalance) return "0";
    return formatBaseUnits(usdcBalance.baseUnits, usdcBalance.decimals);
  }, [usdcBalance]);

  const loadWalletBalances = useCallback(async () => {
    if (!publicKey || !connection) return;

    try {
      const nativeLamports = await connection.getBalance(publicKey, "confirmed");
      setSolBalance(BigInt(nativeLamports));

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
      const balances = tokenAccounts.value.map((account) => {
        const info = account.account.data.parsed?.info;
        const mint = info?.mint;
        const decimals = Number(info?.tokenAmount?.decimals ?? 0);
        const amountString = String(info?.tokenAmount?.amount ?? "0");
        const uiAmount = Number(info?.tokenAmount?.uiAmount ?? 0);
        return {
          mint,
          symbol: getTokenSymbol(mint, networkIsDevnet),
          decimals,
          uiAmount,
          baseUnits: BigInt(amountString),
        };
      }).filter((token) => token.mint && token.baseUnits > 0n) as TokenBalance[];

      const aggregated = balances.reduce<Record<string, TokenBalance>>((acc, token) => {
        const existing = acc[token.mint];
        if (!existing) return { ...acc, [token.mint]: token };
        return {
          ...acc,
          [token.mint]: {
            ...existing,
            baseUnits: existing.baseUnits + token.baseUnits,
            uiAmount: existing.uiAmount + token.uiAmount,
          },
        };
      }, {});

      const tokenList = Object.values(aggregated);
      if (nativeLamports > 0) {
        tokenList.unshift({
          mint: solMintAddress,
          symbol: "SOL",
          decimals: ASSET_MINTS.SOL.decimals,
          uiAmount: Number(nativeLamports) / 1_000_000_000,
          baseUnits: BigInt(nativeLamports),
        });
      }

      setTokenBalances(tokenList);
    } catch (error) {
      console.error("Failed to load wallet balances", error);
    }
  }, [connection, networkIsDevnet, publicKey, solMintAddress]);

  const fetchJupiterQuote = useCallback(async (inputMint: string) => {
    if (!inputMint || expectedUsdcBaseUnits <= 0n) return;
    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint: usdcMintAddress,
        amount: expectedUsdcBaseUnits.toString(),
        swapMode: "ExactOut",
        slippageBps: "50",
      });
      const response = await fetch(`${JUPITER_QUOTE_URL}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Jupiter quote failed: ${response.status}`);
      }

      const data = await response.json();
      const route = Array.isArray(data?.data) ? data.data[0] : null;
      if (!route?.inputAmount) {
        throw new Error("No quote available for selected token");
      }

      setQuoteInputAmount(BigInt(route.inputAmount));
    } catch (error: any) {
      console.error("Jupiter quote error", error);
      setQuoteError(error?.message ?? "Unable to quote swap");
      setQuoteInputAmount(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [expectedUsdcBaseUnits, usdcMintAddress]);

  useEffect(() => {
    if (!connected) return;
    void loadWalletBalances();
  }, [connected, loadWalletBalances]);

  useEffect(() => {
    if (!selectedTokenMint || selectedTokenMint === usdcMintAddress) {
      setQuoteInputAmount(null);
      setQuoteError(null);
      return;
    }
    void fetchJupiterQuote(selectedTokenMint);
  }, [fetchJupiterQuote, selectedTokenMint, usdcMintAddress]);

  const buildSwapTransaction = useCallback(async () => {
    if (!connection || !publicKey || !selectedTokenMint || !quoteInputAmount || !merchantWallet) {
      throw new Error("Missing swap checkout parameters");
    }

    const destinationTokenAccount = await resolveUsdcDestinationAccount(connection, merchantWallet, new PublicKey(usdcMintAddress));
    const payload = {
      inputMint: selectedTokenMint,
      outputMint: usdcMintAddress,
      amount: expectedUsdcBaseUnits.toString(),
      swapMode: "ExactOut",
      slippageBps: 50,
      userPublicKey: publicKey.toBase58(),
      destinationTokenAccount: destinationTokenAccount.toBase58(),
    };

    const response = await fetch(JUPITER_SWAP_INSTRUCTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap instructions failed: ${response.status}`);
    }

    const data = await response.json();
    const swapTransactionBase64 = typeof data?.swapTransaction === "string"
      ? data.swapTransaction
      : typeof data?.swapTransaction?.transaction === "string"
        ? data.swapTransaction.transaction
        : null;

    if (!swapTransactionBase64) {
      throw new Error("Jupiter swap response missing transaction payload");
    }

    const swapTx = VersionedTransaction.deserialize(fromBase64(swapTransactionBase64));
    const tipInstruction = SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: JITO_TIP_ACCOUNT,
      lamports: 100_000,
    });

    const blockhashInfo = await connection.getLatestBlockhash("finalized");
    const messageV0 = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhashInfo.blockhash,
      instructions: [...swapTx.message.instructions, tipInstruction],
      addressLookupTableAccounts: swapTx.message.addressLookupTableAccounts ?? [],
    }).compileToV0Message();

    return new VersionedTransaction(messageV0);
  }, [connection, expectedUsdcBaseUnits, merchantWallet, publicKey, quoteInputAmount, selectedTokenMint, usdcMintAddress]);

  const submitSwapPayment = useCallback(async () => {
    if (!(signTransaction || signAndSendTransaction) || !connection) {
      throw new Error("Wallet must support transaction signing");
    }

    const transaction = await buildSwapTransaction();
    let serialized: Uint8Array;

    if (signAndSendTransaction) {
      const res = await signAndSendTransaction(transaction as any);
      if (res && (res as any).signature) {
        try {
          const signed = await (transaction as any).serialize?.() ?? null;
          serialized = signed || new Uint8Array();
        } catch {
          serialized = new Uint8Array();
        }
      } else {
        const signed = await signTransaction!(transaction as any);
        serialized = signed.serialize();
      }
    } else {
      const signed = await signTransaction!(transaction as any);
      serialized = signed.serialize();
    }
    const encoded = toBase64(serialized);

    try {
      const jitoResult = await sendJitoBundle([encoded]);
      if (jitoResult.success) {
        return jitoResult.bundleId;
      }
      console.warn("Jito bundle failed, falling back to raw send", jitoResult.error);
    } catch (error) {
      console.warn("Jito bundle submission error", error);
    }

    const signature = await connection.sendRawTransaction(serialized, { skipPreflight: true, maxRetries: 5 });
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  }, [buildSwapTransaction, connection, signTransaction, signAndSendTransaction]);

  const handleDirectUsdcPay = useCallback(async () => {
    if (!publicKey || !connection || !(signTransaction || signAndSendTransaction) || !merchantWallet) {
      throw new Error("Wallet connection is required");
    }

    const usdcMint = new PublicKey(usdcMintAddress);
    const payerTokenAccount = await getAssociatedTokenAddress(usdcMint, publicKey, false);
    const destinationTokenAccount = await resolveUsdcDestinationAccount(connection, merchantWallet, usdcMint);
    const transferIx = createTransferInstruction(payerTokenAccount, destinationTokenAccount, publicKey, expectedUsdcBaseUnits);

    const tx = new Transaction().add(transferIx);
    let signature: string;
    if (signAndSendTransaction) {
      const res = await signAndSendTransaction(tx as any);
      signature = (res && (res as any).signature) || String(res);
    } else {
      const signedTx = await signTransaction!(tx as any);
      signature = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true, maxRetries: 5 });
    }
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  }, [connection, expectedUsdcBaseUnits, merchantWallet, publicKey, signTransaction, signAndSendTransaction, usdcMintAddress]);

  const handleCheckout = useCallback(async () => {
    if (!isCheckoutMode) return;

    setCheckoutLoading(true);
    setToast(null);
    setErrorState(null);

    try {
      if (usdcBalanceSufficient) {
        await handleDirectUsdcPay();
      } else {
        if (!selectedBalance || !quoteInputAmount) {
          throw new Error("Select an alternate token for swap");
        }
        await submitSwapPayment();
      }

      setToast("Payment completed successfully");
      onSuccess?.();
    } catch (error: any) {
      console.error("[Terminal Payment Exception]:", error);
      setErrorState({
        message: error?.message || "The payment flow hit an unexpected runtime issue.",
        step: "payment_execution",
      });
      setToast(error?.message ?? "Payment failed");
    } finally {
      setCheckoutLoading(false);
    }
  }, [handleDirectUsdcPay, isCheckoutMode, onSuccess, quoteInputAmount, selectedBalance, submitSwapPayment, usdcBalanceSufficient]);

  const renderCheckoutContent = () => {
    const connectedLabel = connected ? "Wallet connected" : "Connect wallet to pay";
    const selectedSymbol = selectedBalance?.symbol ?? "token";
    const requiredInput = selectedBalance && quoteInputAmount
      ? formatBaseUnits(quoteInputAmount, selectedBalance.decimals)
      : null;

    return (
      <div className="space-y-6 rounded-[2.5rem] border border-white/10 bg-[#0c0d11] p-6 shadow-2xl shadow-black/40">
        {errorState && (
          <div className="bg-red-950/40 border border-red-500/30 p-6 rounded-3xl animate-in fade-in duration-300 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl">
                <LucideAlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-red-400 tracking-wider">
                  Terminal Error
                </h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {errorState.message}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                  The terminal interface can recover automatically. Retry the step or return to the home screen.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pt-2 border-t border-red-500/10">
              <button
                onClick={() => void handleCheckout()}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <LucideRefreshCw size={14} className={checkoutLoading ? "animate-spin" : ""} /> Retry Flow
              </button>
              <button
                onClick={() => {
                  setErrorState(null);
                  router.push("/vault/dashboard");
                }}
                className="py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10 transition-all"
              >
                <LucideHome size={14} /> Home Screen
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Checkout Session</p>
            <h2 className="mt-2 text-3xl font-black text-white">Pay {currency} {amount?.toFixed(2)}</h2>
            <p className="text-sm text-zinc-400">Target merchant settlement wallet</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-emerald-300">
            <span>⚡ MEV Protected via Jito Bundle</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#050507] p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">USDC Balance</p>
            <p className="mt-3 text-2xl font-black text-white">{parsedUsdcBalance}</p>
            <p className="mt-2 text-xs text-zinc-400">Target: {amount?.toFixed(2)} USDC</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#050507] p-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">SOL Balance</p>
            <p className="mt-3 text-2xl font-black text-white">{formatBaseUnits(solBalance, ASSET_MINTS.SOL.decimals)}</p>
            <p className="mt-2 text-xs text-zinc-400">Network: {networkIsDevnet ? "Devnet" : "Mainnet"}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#050507] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Wallet</p>
              <p className="mt-3 text-base font-black text-white">{connectedLabel}</p>
            </div>
            <WalletMultiButton className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-black uppercase text-white shadow-lg shadow-violet-500/20" />
          </div>
        </div>

        {connected && (
          <div className="space-y-4 rounded-3xl border border-white/10 bg-[#050507] p-5">
            {usdcBalanceSufficient ? (
              <div className="rounded-3xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">Direct USDC Payment Available</p>
                <p className="mt-3 text-white">You have enough USDC to pay directly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-yellow-500/10 bg-yellow-500/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-yellow-300">USDC Balance Insufficient</p>
                  <p className="mt-3 text-white">Select another token to auto-swap into USDC.</p>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-500">Pay with another token</label>
                  <select
                    value={selectedTokenMint ?? ""}
                    onChange={(event) => setSelectedTokenMint(event.target.value || null)}
                    className="mt-3 w-full rounded-3xl border border-white/10 bg-[#020203] px-4 py-3 text-white outline-none"
                  >
                    <option value="">Select token</option>
                    {availableSwapTokens.map((token) => (
                      <option key={token.mint} value={token.mint}>
                        {token.symbol} • {formatBaseUnits(token.baseUnits, token.decimals)}
                      </option>
                    ))}
                  </select>
                </div>
                {quoteLoading && <p className="text-sm text-zinc-400">Fetching swap quote…</p>}
                {quoteError && <p className="text-sm text-red-400">{quoteError}</p>}
                {selectedBalance && requiredInput ? (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Estimated Input</p>
                    <p className="mt-3 text-lg font-black text-white">Pay ~{requiredInput} {selectedSymbol}</p>
                    <p className="mt-1 text-sm text-zinc-400">for {amount?.toFixed(2)} USDC</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!connected || checkoutLoading || (!usdcBalanceSufficient && (!selectedBalance || !quoteInputAmount))}
          onClick={() => void handleCheckout()}
          className="w-full rounded-3xl bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-xl shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkoutLoading ? "Processing payment…" : usdcBalanceSufficient ? "Pay with USDC" : "Swap & Pay with Jito Bundle"}
        </button>
      </div>
    );
  };

  useEffect(() => {
    let cancelled = false;

    const initMerchantId = async () => {
      const storedMerchantId = getStoredMerchantId();
      if (storedMerchantId && !cancelled) {
        setResolvedMerchantId(storedMerchantId);
      }

      const id = await resolveMerchantId();
      if (!cancelled) {
        setResolvedMerchantId(id);
      }
    };

    void initMerchantId();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!resolvedMerchantId) return;

    void loadFromSupabase();

    const supabase = createSupabaseBrowserClient();
    if (fleetChannelRef.current) {
      void supabase.removeChannel(fleetChannelRef.current);
      fleetChannelRef.current = null;
    }

    const channel = supabase
      .channel(`fleet:${resolvedMerchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "terminals",
          filter: `merchant_id=eq.${resolvedMerchantId}`,
        },
        () => {
          void loadFromSupabase();
        }
      )
      .subscribe();

    fleetChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      fleetChannelRef.current = null;
    };
  }, [loadFromSupabase, resolvedMerchantId]);

  const pairNewTerminal = async () => {
    if (!resolvedMerchantId) {
      setToast("Merchant session loading, please wait...");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const defaultLabel = createDefaultTerminalLabel();
    setNewTerminalLabel(defaultLabel);
    setAuthCode("---");
    setPairingState("waiting");
    setPairingExpiresAt(null);
    setTimeLeft("GENERATING...");
    setIsPairingOpen(true);
    await refreshAuthCode(defaultLabel);
  };

  const disconnectTerminal = async (id: string) => {
    if (confirm("Unpair this terminal? New pairing code required to log in again.")) {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("terminals").delete().eq("id", id);
        if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Failed to delete terminal from Supabase", error);
      }

      const updated = safeTerminals.filter((terminal) => terminal.id !== id);
      await persistTerminals(updated);
    }
  };

  if (isCheckoutMode) {
    return renderCheckoutContent();
  }

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0d0d11] p-6 shadow-2xl shadow-black/40">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LucideBell size={14} className="text-zinc-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Hardware Fleet</h3>
          </div>
          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">
            • {safeTerminals.length} secured nodes
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              void pairNewTerminal();
            }}
            disabled={isRefreshingCode}
            className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-zinc-200 disabled:opacity-60"
          >
            <LucidePlus size={14} /> {isRefreshingCode ? "Generating..." : "Pair New"}
          </button>
          <button
            onClick={() => void loadFromSupabase()}
            disabled={isLoadingTerminals}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300 transition-all hover:bg-zinc-800 disabled:opacity-60"
          >
            <LucideRefreshCw size={14} className={isLoadingTerminals ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-[#050507] p-6">
        {safeTerminals.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-zinc-500">
              <LucideHardDrive size={24} />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">No Nodes Connected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {safeTerminals.map((terminal) => (
              <div key={terminal.id} className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-400">
                    <LucideHardDrive size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{terminal.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                      {terminal.isActive ? "Active • Staff logged in" : "Ready • Awaiting staff login"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void disconnectTerminal(terminal.id)}
                  className="text-zinc-600 transition-all hover:text-red-500"
                  aria-label="Remove terminal"
                >
                  <LucideTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PairingModal
        isOpen={isPairingOpen}
        onClose={closePairingModal}
        authCode={authCode}
        onRefresh={() => {
          void refreshAuthCode();
        }}
        timeLeft={timeLeft}
        terminalName={newTerminalLabel}
        onTerminalNameChange={(v) => setNewTerminalLabel(v)}
        pairingState={pairingState}
      />
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase z-50 shadow-lg transition-opacity duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
