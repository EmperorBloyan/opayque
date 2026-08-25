import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { requestPrivateSplTransfer } from '@/lib/magicblock';
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from '@/lib/solana/constants';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRequestRateLimit } from '@/lib/rate-limit';

const isDevnet = isDevnetNetwork();

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

    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateLimit = checkRequestRateLimit(`transfer:${address}`, 10);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many transfer requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!sender || !recipient || typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required transfer parameters (sender, recipient, amount)' },
        { status: 400 }
      );
    }

    const senderPubkey = new PublicKey(sender);
    const recipientPubkey = new PublicKey(recipient);
    const expectedMint = getAssetMintAddress('USDC', isDevnet);
    const mintAddress = typeof mint === 'string' && mint.length > 0 ? new PublicKey(mint).toBase58() : expectedMint;
    if (mintAddress !== expectedMint) {
      return NextResponse.json({ error: 'Only the configured network USDC mint is supported for private payments' }, { status: 400 });
    }
    const amountBaseUnits = Math.round(amount * 1_000_000);
    if (!Number.isSafeInteger(amountBaseUnits) || amountBaseUnits <= 0 || amountBaseUnits >= 1_000_000_000_000) {
      return NextResponse.json({ error: 'Payment amount must be a valid USDC amount' }, { status: 400 });
    }

    const privateTransfer = await requestPrivateSplTransfer({
      sender: senderPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      mint: mintAddress,
      amountBaseUnits,
      memo: typeof merchant_id === 'string' ? merchant_id.slice(0, 64) : undefined,
    });

    if (merchant_id && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createSupabaseServerClient();
        await supabase.from('transactions').insert({
          merchant_id,
          token_symbol: 'USDC',
          amount: Number((amountBaseUnits / 1_000_000).toFixed(6)),
          status: 'pending_signature',
        });
      } catch (supabaseError) {
        console.error('Supabase insert failed:', supabaseError);
      }
    }

    return NextResponse.json({
      success: true,
      transaction: privateTransfer.transaction,
      blockhash: privateTransfer.blockhash,
      lastValidBlockHeight: privateTransfer.lastValidBlockHeight,
      rpcUrl: privateTransfer.rpcUrl,
      mode: 'private',
      cluster: getSolanaNetwork() === 'mainnet-beta' ? 'mainnet' : 'devnet',
    });
  } catch (error: unknown) {
    console.error('Error constructing transaction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
