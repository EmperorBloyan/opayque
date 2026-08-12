import { NextResponse } from 'next/server';
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  createShieldedPaymentInstruction,
  USDC_MINT,
} from '@/lib/magicblock';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sender, recipient, amount, mint, merchant_id } = body as {
      sender?: string;
      recipient?: string;
      amount?: number;
      mint?: string;
      merchant_id?: string;
    };

    if (!sender || !recipient || typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required transfer parameters (sender, recipient, amount)' },
        { status: 400 }
      );
    }

    const senderPubkey = new PublicKey(sender);
    const recipientPubkey = new PublicKey(recipient);
    const mintPubkey = typeof mint === 'string' && mint.length > 0 ? new PublicKey(mint) : USDC_MINT;

    // The frontend sends `amount` in atomic token units (USDC has 6 decimals).
    // Normalize to token base units (e.g. 1 USDC = 1.0) for the internal helper
    // which expects a human-readable amount.
    const normalizedAmount = amount / 1_000_000;
    const bundle = await createShieldedPaymentInstruction(
      senderPubkey,
      recipientPubkey,
      normalizedAmount,
      mintPubkey
    );

    if (bundle.summary.status !== 'ready') {
      return NextResponse.json(
        { error: bundle.summary.message || 'Failed to create shielded payment instructions' },
        { status: 500 }
      );
    }

    const recipientAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);
    const ataInstruction = createAssociatedTokenAccountIdempotentInstruction(
      senderPubkey,
      recipientAta,
      recipientPubkey,
      mintPubkey
    );

    const instructions = [ataInstruction, ...bundle.instructions, ...bundle.cleanupInstructions];
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const messageV0 = new TransactionMessage({
      payerKey: senderPubkey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    if (merchant_id && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createSupabaseServerClient();
        await supabase.from('transactions').insert({
          merchant_id,
          token_symbol: 'USDC',
          amount: amount / 1_000_000,
          status: 'pending_signature',
        });
      } catch (supabaseError) {
        console.error('Supabase insert failed:', supabaseError);
      }
    }

    return NextResponse.json({
      success: true,
      transaction: serializedTx,
    });
  } catch (error: unknown) {
    console.error('Error constructing transaction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
