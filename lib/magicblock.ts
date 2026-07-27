import { PublicKey, VersionedTransaction } from '@solana/web3.js';

export const PAYMENTS_API = 'https://payments.magicblock.app';
export const TEE_RPC = 'https://devnet-tee.magicblock.app';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

function base64ToUint8Array(base64: string): Uint8Array {
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
  const response = await fetch(`${PAYMENTS_API}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      recipient,
      amount: Math.floor(amount * 1_000_000),
      mint: USDC_MINT.toBase58(),
      private: true,
    }),
  });

  const data = await response.json();
  return VersionedTransaction.deserialize(base64ToUint8Array(data.transaction));
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

  const data = await response.json();
  return VersionedTransaction.deserialize(base64ToUint8Array(data.transaction));
}
