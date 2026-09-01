import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { requestPrivateSplTransfer } from '@/lib/magicblock';
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from '@/lib/solana/constants';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientAddress, strictLimit } from '@/lib/rate-limit';
import * as Sentry from '@/lib/sentry';

const isDevnet = isDevnetNetwork();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sender, recipient, amount, mint, intent_id, memo } = body as {
      sender?: string;
      recipient?: string;
      amount?: number;
      mint?: string;
      intent_id?: string;
      memo?: string;
    };

    if (!sender || !recipient || typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required transfer parameters (sender, recipient, amount)' },
        { status: 400 }
      );
    }

    const senderPubkey = new PublicKey(sender);
    const recipientPubkey = new PublicKey(recipient);
    const address = getClientAddress(request);
    const rateLimit = await strictLimit(`transfer:${address}:${senderPubkey.toBase58()}`, true);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.error || "Too many transfer requests. Please try again later." },
        { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
    if (!intent_id) {
      return NextResponse.json({ error: "Payment intent is required" }, { status: 400 });
    }
    const expectedMint = getAssetMintAddress('USDC', isDevnet);
    const mintAddress = typeof mint === 'string' && mint.length > 0 ? new PublicKey(mint).toBase58() : expectedMint;
    if (mintAddress !== expectedMint) {
      return NextResponse.json({ error: 'Only the configured network USDC mint is supported for private payments' }, { status: 400 });
    }
    const amountBaseUnits = Math.round(amount * 1_000_000);
    if (!Number.isSafeInteger(amountBaseUnits) || amountBaseUnits <= 0 || amountBaseUnits >= 1_000_000_000_000) {
      return NextResponse.json({ error: 'Payment amount must be a valid USDC amount' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    let intent: any = null;
    const transactionIntent = await supabase
      .from("transactions")
      .select("id, merchant_id, amount, status")
      .eq("id", intent_id)
      .maybeSingle();
    if (!transactionIntent.error) intent = transactionIntent.data;

    if (!intent) {
      const sessionIntent = await supabase
        .from("checkout_sessions")
        .select("id, merchant_id, amount, amount_token, status, settlement_token")
        .eq("id", intent_id)
        .maybeSingle();
      if (!sessionIntent.error) intent = sessionIntent.data;
    }

    if (!intent || !["created", "pending_signature", "submitted"].includes(String(intent.status || "created").toLowerCase())) {
      return NextResponse.json({ error: "Payment intent is invalid or no longer payable" }, { status: 409 });
    }

    const expectedAmount = Number(intent.amount_token ?? intent.amount);
    if (!Number.isFinite(expectedAmount) || Math.abs(expectedAmount - amount) > 0.000001) {
      return NextResponse.json({ error: "Payment amount does not match the payment intent" }, { status: 400 });
    }
    const merchant = await supabase
      .from("merchants")
      .select("settlement_wallet_address, wallet_address")
      .eq("id", intent.merchant_id)
      .maybeSingle();
    const expectedRecipient = String(merchant.data?.settlement_wallet_address || merchant.data?.wallet_address || "");
    if (!expectedRecipient || expectedRecipient !== recipientPubkey.toBase58()) {
      return NextResponse.json({ error: "Payment recipient does not match the merchant intent" }, { status: 400 });
    }

    const privateTransfer = await requestPrivateSplTransfer({
      sender: senderPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      mint: mintAddress,
      amountBaseUnits,
      memo: typeof memo === 'string' ? memo.slice(0, 64) : intent_id.slice(0, 64),
    });

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
    Sentry.captureException(error);
    console.error('Error constructing transaction:', error instanceof Error ? error.message : 'unknown error');
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = /timed out|timeout/i.test(message)
      ? 504
      : /invalid public key|invalid.*amount|missing/i.test(message)
        ? 400
        : /rpc|magicblock|tee|upstream|network/i.test(message)
          ? 502
          : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
