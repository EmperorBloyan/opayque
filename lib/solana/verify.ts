import { Connection, PublicKey } from '@solana/web3.js';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

interface VerifyTxParams {
  signature: string;
  expectedMerchantWallet: string;
  expectedAmount: number;
}

export async function verifySolanaTransaction({
  signature,
  expectedMerchantWallet,
  expectedAmount,
}: VerifyTxParams) {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || tx.meta?.err) {
      return { verified: false, reason: 'Transaction failed or not found on-chain' };
    }

    // Verify token/SOL transfer instruction targeting the expected merchant wallet
    const instructions = tx.transaction.message.instructions;
    const isTargetingWallet = instructions.some((inst) => {
      if ('parsed' in inst && inst.parsed?.info) {
        const destination = inst.parsed.info.destination || inst.parsed.info.to;
        return destination === expectedMerchantWallet;
      }
      return false;
    });

    return {
      verified: true,
      slot: tx.slot,
      blockTime: tx.blockTime,
      fee: tx.meta.fee,
    };
  } catch (error: any) {
    console.error('Solana RPC Verification Error:', error);
    return { verified: false, reason: error.message };
  }
}
