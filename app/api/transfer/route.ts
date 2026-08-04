import { NextResponse } from 'next/server';
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { createShieldedPaymentInstruction } from '@/lib/solana/confidential';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || 'https://devnet-tee.magicblock.app';
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

    if (!sender || !recipient || typeof amount !== 'number' || !mint) {
      return NextResponse.json(
        { error: 'Missing required transfer parameters (sender, recipient, amount, mint)' },
        { status: 400 }
      );
    }

    const senderPubkey = new PublicKey(sender);
    const recipientPubkey = new PublicKey(recipient);
    const mintPubkey = new PublicKey(mint);

    const sourceMint = await connection.getParsedAccountInfo(mintPubkey);
    if (!sourceMint.value) {
      return NextResponse.json(
        { error: 'Unable to fetch mint account for transfer' },
        { status: 502 }
      );
    }

    const mintData: any = sourceMint.value.data;
    const decimals = Number(
      mintData?.parsed?.info?.decimals ?? mintData?.parsed?.info?.decimals ?? 6
    );
    const uiAmount = amount / Math.pow(10, decimals);

    const bundle = await createShieldedPaymentInstruction(
      connection,
      senderPubkey,
      recipientPubkey,
      uiAmount,
      mintPubkey
    );

    if (bundle.summary.status !== 'ready') {
      return NextResponse.json(
        { error: bundle.summary.message || 'Failed to create shielded payment instructions' },
        { status: 500 }
      );
    }

    const instructions = [...bundle.instructions, ...bundle.cleanupInstructions];
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const messageV0 = new TransactionMessage({
      payerKey: senderPubkey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    if (merchant_id) {
      try {
        const supabase = createSupabaseServerClient();
        await supabase.from('transactions').insert({
          merchant_id,
          token_symbol: 'USDC',
          amount: amount / Math.pow(10, decimals),
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
