import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { createShieldedPaymentInstruction as createShieldedPaymentInstructionImpl } from '@/lib/solana/confidential';
import { getAssetMintAddress } from "@/lib/solana/constants";

export const PAYMENTS_API = process.env.NEXT_PUBLIC_MAGICBLOCK_API || 'https://payments.magicblock.app';
export const TEE_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
export const USDC_MINT = new PublicKey(getAssetMintAddress("USDC", true));

export async function createShieldedPaymentInstruction(
  sender: PublicKey,
  recipient: PublicKey,
  amount: number,
  mint: PublicKey = USDC_MINT
) {
  return createShieldedPaymentInstructionImpl(
    connection,
    sender,
    recipient,
    amount,
    mint
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Missing transaction payload from MagicBlock API.');
  }

  const normalizedBase64 = base64.replace(/\s+/g, '');
  const binaryString = typeof window !== 'undefined'
    ? atob(normalizedBase64)
    : Buffer.from(normalizedBase64, 'base64').toString('binary');

  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

export async function getPrivateBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${PAYMENTS_API}/balance/private`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, mint: USDC_MINT.toBase58() }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch balance');
    }

    const data = await response.json();
    return (data.balance ?? 0) / 1_000_000;
  } catch (error) {
    console.error('Private balance error:', error);
    return 0;
  }
}

export async function buildShieldedTransfer(sender: string, recipient: string, amount: number) {
  const response = await fetch('/api/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      recipient,
      amount,
      mint: USDC_MINT.toBase58(),
      private: true,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.transaction || typeof data.transaction !== 'string') {
    console.error('MagicBlock transfer API error:', data);

    let errorMessage = 'The MagicBlock TEE rejected the transfer request.';

    if (typeof data?.message === 'string') {
      errorMessage = data.message;
    } else if (typeof data?.error === 'string') {
      errorMessage = data.error;
    } else if (data?.message || data?.error) {
      errorMessage = JSON.stringify(data.message || data.error);
    }

    throw new Error(errorMessage);
  }

  try {
    return VersionedTransaction.deserialize(base64ToUint8Array(data.transaction));
  } catch (err) {
    console.error('Failed to deserialize transaction from MagicBlock:', err, data);
    throw new Error('Invalid transaction payload returned from MagicBlock TEE.');
  }
}

export async function buildWithdraw(merchantPubkey: string, destination: string, amount: number) {
  const response = await fetch(`${PAYMENTS_API}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: merchantPubkey,
      destination,
      amount: Math.floor(amount * 1_000_000),
      mint: USDC_MINT.toBase58(),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.transaction || typeof data.transaction !== 'string') {
    console.error('MagicBlock withdraw API error:', data);

    let errorMessage = 'The MagicBlock TEE rejected the withdrawal request.';

    if (typeof data?.message === 'string') {
      errorMessage = data.message;
    } else if (typeof data?.error === 'string') {
      errorMessage = data.error;
    } else if (data?.message || data?.error) {
      errorMessage = JSON.stringify(data.message || data.error);
    }

    throw new Error(errorMessage);
  }

  try {
    return VersionedTransaction.deserialize(base64ToUint8Array(data.transaction));
  } catch (err) {
    console.error('Failed to deserialize withdraw transaction from MagicBlock:', err, data);
    throw new Error('Invalid withdrawal transaction payload returned from MagicBlock TEE.');
  }
}
