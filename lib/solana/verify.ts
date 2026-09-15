import { Connection } from '@solana/web3.js';
import { selectHealthyRpcUrl } from './rpc';

const DEFAULT_USDC_DECIMALS = 6;

type ParsedInstructionLike = {
  program?: string;
  parsed?: {
    type?: string;
    info?: Record<string, unknown>;
  };
};

interface VerifyTxParams {
  signature: string;
  expectedMerchantWallet: string;
  expectedSender?: string | null;
  expectedAmount: number;
  expectedAmountBaseUnits?: bigint;
  expectedTokenMint?: string;
  expectedTokenDecimals?: number;
  rpcUrl?: string;
}

interface VerifyTxSuccess {
  verified: true;
  status: 'success';
  slot: number;
  blockTime: number | null;
  fee: number;
  actualTransferredBaseUnits: bigint;
  expectedBaseUnits: bigint;
}

interface VerifyTxFailure {
  verified: false;
  status: 'underpaid' | 'failed';
  reason: string;
  slot?: number;
  blockTime?: number | null;
  fee?: number;
  actualTransferredBaseUnits?: bigint;
  expectedBaseUnits?: bigint;
}

export type VerifyTxResult = VerifyTxSuccess | VerifyTxFailure;

function parseHumanAmountToBaseUnits(amount: number, decimals: number): bigint {
  const amountString = amount.toString();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountString)) {
    throw new Error('Invalid expected amount format');
  }

  const [whole, fraction = ''] = amountString.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Expected amount has more than ${decimals} decimal places`);
  }

  const normalizedFraction = fraction.padEnd(decimals, '0');
  return BigInt(whole + normalizedFraction);
}

function getSolTransferBaseUnits(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedMerchantWallet: string,
): bigint {
  if (!tx.meta?.preBalances || !tx.meta?.postBalances) {
    throw new Error('Missing transaction balance metadata for SOL verification');
  }

  const accountKeys = tx.transaction.message.accountKeys;
  let totalReceived = 0n;

  for (let index = 0; index < accountKeys.length; index += 1) {
    const accountPubkey = accountKeys[index].pubkey.toBase58();
    if (accountPubkey !== expectedMerchantWallet) continue;

    const preBalance = BigInt(tx.meta.preBalances[index]);
    const postBalance = BigInt(tx.meta.postBalances[index]);
    const delta = postBalance - preBalance;
    if (delta > 0n) {
      totalReceived += delta;
    }
  }

  return totalReceived;
}

function hasExpectedSenderSolTransfer(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedSender: string,
  expectedBaseUnits: bigint,
): boolean {
  const accountKeys = tx.transaction.message.accountKeys;
  for (let index = 0; index < accountKeys.length; index += 1) {
    if (accountKeys[index].pubkey.toBase58() !== expectedSender) continue;
    const preBalance = BigInt(tx.meta?.preBalances?.[index] ?? 0);
    const postBalance = BigInt(tx.meta?.postBalances?.[index] ?? 0);
    return preBalance - postBalance >= expectedBaseUnits;
  }
  return false;
}

function hasExpectedSolInstruction(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedSender: string,
  expectedRecipient: string,
  expectedBaseUnits: bigint,
): boolean {
  return tx.transaction.message.instructions.some((instruction) => {
    const parsedInstruction = instruction as ParsedInstructionLike;
    const info = parsedInstruction.parsed?.info;
    if (parsedInstruction.program !== 'system' || parsedInstruction.parsed?.type !== 'transfer' || !info) return false;
    return info.source === expectedSender && info.destination === expectedRecipient && BigInt(String(info.lamports)) === expectedBaseUnits;
  });
}

function getSplTransferBaseUnits(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedMerchantWallet: string,
  expectedTokenMint: string,
): bigint {
  if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
    throw new Error('Missing token balance metadata for SPL token verification');
  }

  const preBalances = new Map<string, bigint>();
  const postBalances = new Map<string, bigint>();

  tx.meta.preTokenBalances.forEach((balance) => {
    if (balance.owner !== expectedMerchantWallet || balance.mint !== expectedTokenMint) return;
    preBalances.set(`${balance.accountIndex}`, BigInt(balance.uiTokenAmount.amount));
  });

  tx.meta.postTokenBalances.forEach((balance) => {
    if (balance.owner !== expectedMerchantWallet || balance.mint !== expectedTokenMint) return;
    postBalances.set(`${balance.accountIndex}`, BigInt(balance.uiTokenAmount.amount));
  });

  const allIndices = new Set<string>([...preBalances.keys(), ...postBalances.keys()]);
  let totalReceived = 0n;

  allIndices.forEach((index) => {
    const preAmount = preBalances.get(index) ?? 0n;
    const postAmount = postBalances.get(index) ?? 0n;
    const delta = postAmount - preAmount;
    if (delta > 0n) {
      totalReceived += delta;
    }
  });

  return totalReceived;
}

function hasExpectedSenderSplTransfer(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedSender: string,
  expectedTokenMint: string,
  expectedBaseUnits: bigint,
): boolean {
  if (!tx.meta?.preTokenBalances || !tx.meta.postTokenBalances) return false;

  const preBalances = new Map<string, bigint>();
  const postBalances = new Map<string, bigint>();
  tx.meta.preTokenBalances.forEach((balance) => {
    if (balance.owner === expectedSender && balance.mint === expectedTokenMint) {
      preBalances.set(`${balance.accountIndex}`, BigInt(balance.uiTokenAmount.amount));
    }
  });
  tx.meta.postTokenBalances.forEach((balance) => {
    if (balance.owner === expectedSender && balance.mint === expectedTokenMint) {
      postBalances.set(`${balance.accountIndex}`, BigInt(balance.uiTokenAmount.amount));
    }
  });

  for (const index of new Set([...preBalances.keys(), ...postBalances.keys()])) {
    const decrease = (preBalances.get(index) ?? 0n) - (postBalances.get(index) ?? 0n);
    if (decrease >= expectedBaseUnits) return true;
  }
  return false;
}

function hasExpectedSplInstruction(
  tx: NonNullable<Awaited<ReturnType<Connection['getParsedTransaction']>>>,
  expectedSender: string,
  expectedRecipient: string,
  expectedTokenMint: string,
  expectedBaseUnits: bigint,
): boolean {
  const recipientTokenAccounts = new Set(
    (tx.meta?.postTokenBalances ?? [])
      .filter((balance) => balance.owner === expectedRecipient && balance.mint === expectedTokenMint)
      .map((balance) => balance.accountIndex),
  );
  const senderTokenAccounts = new Set(
    (tx.meta?.preTokenBalances ?? [])
      .filter((balance) => balance.owner === expectedSender && balance.mint === expectedTokenMint)
      .map((balance) => balance.accountIndex),
  );
  const accountKeys = tx.transaction.message.accountKeys;

  return tx.transaction.message.instructions.some((instruction) => {
    const parsedInstruction = instruction as ParsedInstructionLike;
    const info = parsedInstruction.parsed?.info;
    if (!info || !['spl-token', 'spl-token-2022'].includes(parsedInstruction.program ?? '')) return false;
    if (!['transfer', 'transferChecked'].includes(parsedInstruction.parsed?.type ?? '')) return false;
    const source = String(info.source ?? '');
    const destination = String(info.destination ?? '');
    const sourceIndex = accountKeys.findIndex((account) => account.pubkey.toBase58() === source);
    const destinationIndex = accountKeys.findIndex((account) => account.pubkey.toBase58() === destination);
    const tokenAmount = info.amount ?? (info.tokenAmount as { amount?: unknown } | undefined)?.amount;
    return sourceIndex >= 0 && destinationIndex >= 0 && senderTokenAccounts.has(sourceIndex) && recipientTokenAccounts.has(destinationIndex) && String(info.mint ?? expectedTokenMint) === expectedTokenMint && BigInt(String(tokenAmount)) === expectedBaseUnits;
  });
}

export async function verifySolanaTransaction({
  signature,
  expectedMerchantWallet,
  expectedSender,
  expectedAmount,
  expectedAmountBaseUnits,
  expectedTokenMint,
  expectedTokenDecimals,
  rpcUrl,
}: VerifyTxParams): Promise<VerifyTxResult> {
  try {
    const connection = new Connection(rpcUrl || await selectHealthyRpcUrl(), 'finalized');
    let tx: Awaited<ReturnType<Connection['getParsedTransaction']>> = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized',
      });
      if (tx) break;
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }

    if (!tx || !tx.meta || tx.meta.err) {
      return { verified: false, status: 'failed', reason: 'Transaction failed or not found on-chain' };
    }

    const slot = tx.slot;
    const blockTime = tx.blockTime ?? null;
    const fee = tx.meta.fee;

    let actualTransferredBaseUnits: bigint;
    let expectedBaseUnits: bigint;

    if (expectedTokenMint) {
      const decimals = expectedTokenDecimals ?? DEFAULT_USDC_DECIMALS;
      actualTransferredBaseUnits = getSplTransferBaseUnits(tx, expectedMerchantWallet, expectedTokenMint);
      expectedBaseUnits = expectedAmountBaseUnits ?? parseHumanAmountToBaseUnits(expectedAmount, decimals);
      if (actualTransferredBaseUnits !== expectedBaseUnits) {
        return {
          verified: false,
          status: 'underpaid',
          reason: 'Received amount does not exactly match the payment intent',
          slot,
          blockTime,
          fee,
          actualTransferredBaseUnits,
          expectedBaseUnits,
        };
      }
      if (expectedSender && (!hasExpectedSenderSplTransfer(tx, expectedSender, expectedTokenMint, expectedBaseUnits) || !hasExpectedSplInstruction(tx, expectedSender, expectedMerchantWallet, expectedTokenMint, expectedBaseUnits))) {
        return { verified: false, status: 'failed', reason: 'Expected payment sender was not verified', slot, blockTime, fee, actualTransferredBaseUnits, expectedBaseUnits };
      }
    } else {
      actualTransferredBaseUnits = getSolTransferBaseUnits(tx, expectedMerchantWallet);
      expectedBaseUnits = expectedAmountBaseUnits ?? parseHumanAmountToBaseUnits(expectedAmount, 9);
      if (actualTransferredBaseUnits !== expectedBaseUnits) {
        return {
          verified: false,
          status: 'underpaid',
          reason: 'Received amount does not exactly match the payment intent',
          slot,
          blockTime,
          fee,
          actualTransferredBaseUnits,
          expectedBaseUnits,
        };
      }
      if (expectedSender && (!hasExpectedSenderSolTransfer(tx, expectedSender, expectedBaseUnits) || !hasExpectedSolInstruction(tx, expectedSender, expectedMerchantWallet, expectedBaseUnits))) {
        return { verified: false, status: 'failed', reason: 'Expected payment sender was not verified', slot, blockTime, fee, actualTransferredBaseUnits, expectedBaseUnits };
      }
    }

    return {
      verified: true,
      status: 'success',
      slot,
      blockTime,
      fee,
      actualTransferredBaseUnits,
      expectedBaseUnits,
    };
  } catch (error: any) {
    console.error('Solana RPC Verification Error:', error);
    return {
      verified: false,
      status: 'failed',
      reason: error?.message ?? 'Unknown verification error',
    };
  }
}
