import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { requestPrivateSplTransfer } from '@/lib/magicblock';
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from '@/lib/solana/constants';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientAddress, strictLimit } from '@/lib/rate-limit';
import * as Sentry from '@/lib/sentry';
import { logLifecycle } from '@/lib/observability';
import { resolveSettlementWallet } from '@/lib/merchant/wallets';
import { parseAmountToBaseUnits } from '@/lib/payments/amount';

const isDevnet = isDevnetNetwork();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sender, recipient, amount, mint, intent_id, memo } = body as {
      sender?: string;
      recipient?: string;
      amount?: number | string;
      mint?: string;
      intent_id?: string;
      memo?: string;
    };

    const amountBaseUnits = parseAmountToBaseUnits(amount, 6);
    if (!sender || !recipient || !amountBaseUnits) {
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
    if (amountBaseUnits >= 1_000_000_000_000n) {
      return NextResponse.json({ error: 'Payment amount must be a valid USDC amount' }, { status: 400 });
    }
    if (typeof memo === 'string' && memo.length > 64) {
      return NextResponse.json({ error: 'Payment memo must be 64 characters or fewer' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const ledgerLookup = await supabase
      .from("payment_ledger")
      .select("id, merchant_id, amount, amount_base_units, status, recipient_address, mint")
      .eq("id", intent_id)
      .maybeSingle();
    if (ledgerLookup.error) {
      return NextResponse.json({ error: "Unable to load payment intent" }, { status: 500 });
    }
    const intent = ledgerLookup.data;

    if (!intent || !["created", "pending_signature", "submitted"].includes(String(intent.status || "created").toLowerCase())) {
      return NextResponse.json({ error: "Payment intent is invalid or no longer payable" }, { status: 409 });
    }

    const expectedAmountBaseUnits = intent.amount_base_units !== null && intent.amount_base_units !== undefined
      ? BigInt(intent.amount_base_units)
      : parseAmountToBaseUnits(intent.amount, 6);
    if (!expectedAmountBaseUnits || expectedAmountBaseUnits !== amountBaseUnits) {
      return NextResponse.json({ error: "Payment amount does not match the payment intent" }, { status: 400 });
    }
    const merchant = await supabase
      .from("merchants")
      .select("settlement_wallet_address, wallet_address")
      .eq("id", intent.merchant_id)
      .maybeSingle();
    const expectedRecipient = resolveSettlementWallet(merchant.data).address;
    if (!expectedRecipient || intent.recipient_address !== expectedRecipient || intent.mint !== mintAddress || expectedRecipient !== recipientPubkey.toBase58()) {
      return NextResponse.json({ error: "Payment recipient does not match the merchant intent" }, { status: 400 });
    }

    const privateTransfer = await requestPrivateSplTransfer({
      sender: senderPubkey.toBase58(),
      recipient: recipientPubkey.toBase58(),
      mint: mintAddress,
      amountBaseUnits: Number(amountBaseUnits),
      memo: typeof memo === 'string' ? memo.slice(0, 64) : intent_id.slice(0, 64),
    });
    {
      const { error: intentUpdateError } = await supabase
        .from("payment_ledger")
        .update({ status: "pending_signature", sender_address: senderPubkey.toBase58(), updated_at: new Date().toISOString() })
        .eq("id", intent.id)
        .in("status", ["created", "pending_signature"])
        .select("id")
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
    const message = error instanceof Error ? error.message : '';
    const status = /timed out|timeout/i.test(message)
      ? 504
      : /invalid public key|invalid.*amount|missing/i.test(message)
        ? 400
        : /rpc|magicblock|tee|upstream|network/i.test(message)
          ? 502
          : 500;
    return NextResponse.json(
      { error: status === 504 ? 'MagicBlock request timed out' : status === 400 ? 'Invalid private transfer request' : status === 502 ? 'Private transfer provider unavailable' : 'Unable to prepare private transfer' },
      { status }
    );
  }
}
