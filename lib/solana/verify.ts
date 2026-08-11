import { Connection } from '@solana/web3.js';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

const LAMPORTS_PER_SOL = 10n ** 9n;
const DEFAULT_USDC_DECIMALS = 6;

interface VerifyTxParams {
  signature: string;
  expectedMerchantWallet: string;
  expectedAmount: number;
  expectedTokenMint?: string;
  expectedTokenDecimals?: number;
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

function getSolTransferBaseUnits(tx: Awaited<ReturnType<typeof connection.getParsedTransaction>>, expectedMerchantWallet: string): bigint {
  if (!tx.meta?.preBalances || !tx.meta?.postBalances) {
    throw new Error('Missing transaction balance metadata for SOL verification');
  }

  const accountKeys = tx.transaction.message.accountKeys;
  let totalReceived = 0n;

  for (let index = 0; index < accountKeys.length; index += 1) {
    const accountPubkey = 'pubkey' in accountKeys[index] ? accountKeys[index].pubkey : accountKeys[index].toBase58();
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

function getSplTransferBaseUnits(
  tx: Awaited<ReturnType<typeof connection.getParsedTransaction>>,
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
    preBalances.set(`${balance.accountIndex}`, BigInt(balance.rawTokenAmount.amount));
  });

  tx.meta.postTokenBalances.forEach((balance) => {
    if (balance.owner !== expectedMerchantWallet || balance.mint !== expectedTokenMint) return;
    postBalances.set(`${balance.accountIndex}`, BigInt(balance.rawTokenAmount.amount));
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

export async function verifySolanaTransaction({
  signature,
  expectedMerchantWallet,
  expectedAmount,
  expectedTokenMint,
  expectedTokenDecimals,
}: VerifyTxParams): Promise<VerifyTxResult> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || tx.meta?.err) {
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
      expectedBaseUnits = parseHumanAmountToBaseUnits(expectedAmount, decimals);
    } else {
      actualTransferredBaseUnits = getSolTransferBaseUnits(tx, expectedMerchantWallet);
      expectedBaseUnits = parseHumanAmountToBaseUnits(expectedAmount, 9);
    }

    if (actualTransferredBaseUnits < expectedBaseUnits) {
      return {
        verified: false,
        status: 'underpaid',
        reason: 'Received amount is less than expected',
        slot,
        blockTime,
        fee,
        actualTransferredBaseUnits,
        expectedBaseUnits,
      };
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
