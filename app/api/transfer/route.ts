import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { requestPrivateSplTransfer } from '@/lib/magicblock';
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from '@/lib/solana/constants';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientAddress, strictLimit } from '@/lib/rate-limit';
import * as Sentry from '@/lib/sentry';
import { logLifecycle } from '@/lib/observability';

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
    if (typeof memo === 'string' && memo.length > 64) {
      return NextResponse.json({ error: 'Payment memo must be 64 characters or fewer' }, { status: 400 });
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

    const ledgerIntent = transactionIntent.data || (await supabase
      .from("transactions")
      .select("id, merchant_id, status")
      .eq("checkout_session_id", intent_id)
      .maybeSingle()).data;

    const privateTransfer = await requestPrivateSplTransfer({
      sender: senderPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      mint: mintAddress,
      amountBaseUnits,
      memo: typeof memo === 'string' ? memo.slice(0, 64) : intent_id.slice(0, 64),
    });
    if (ledgerIntent?.id) {
      const { data: updatedIntent, error: intentUpdateError } = await supabase
        .from("transactions")
        .update({ status: "pending_signature", sender_address: senderPubkey.toBase58(), recipient_address: recipientPubkey.toBase58(), amount_base_units: amountBaseUnits, mint: mintAddress, updated_at: new Date().toISOString() })
        .eq("id", ledgerIntent.id)
        .in("status", ["created", "pending_signature"])
        .select("id, merchant_id, amount, amount_base_units, mint, sender_address, recipient_address, signature, status, environment, created_at, updated_at")
        .maybeSingle();
      if (intentUpdateError) throw intentUpdateError;
    }
    logLifecycle("info", "private_transfer", "submit_ready", getSolanaNetwork());

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
    logLifecycle("error", "private_transfer", "failed", getSolanaNetwork(), error instanceof Error ? error.name : "UnknownError");
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
