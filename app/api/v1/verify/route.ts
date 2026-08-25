import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatch';
import { verifySolanaTransaction } from '@/lib/solana/verify';
import { getAssetMintAddress, getSolanaRpcUrl, isDevnetNetwork } from '@/lib/solana/constants';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseServerClient(request);
  try {
    const body = await request.json();
    const { sessionId, transactionSignature } = body;

    if (!sessionId || !transactionSignature) {
      return NextResponse.json({ error: 'Session ID and Transaction Signature required' }, { status: 400 });
    }

    // 1. Fetch the session and the merchant's settlement wallet
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*, merchants(settlement_wallet_address)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ message: 'Session already completed' });
    }

    const expectedMerchantWallet = session.merchants?.settlement_wallet_address;
    if (!expectedMerchantWallet) {
      return NextResponse.json({ error: 'Merchant settlement wallet not configured' }, { status: 400 });
    }

    // 2. Verify against Solana RPC
    const rpcUrl = getSolanaRpcUrl();
    const isDevnet = isDevnetNetwork();
    const settlementToken = String(session.currency || 'USDC').toUpperCase();

    if (settlementToken !== 'USDC') {
      return NextResponse.json({ error: 'Only USDC checkout verification is supported' }, { status: 400 });
    }

    const verification = await verifySolanaTransaction({
      signature: transactionSignature,
      expectedMerchantWallet,
      expectedAmount: session.amount,
      expectedTokenMint: getAssetMintAddress('USDC', isDevnet),
      expectedTokenDecimals: 6,
      rpcUrl,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'On-chain verification failed', details: verification.reason }, { status: 400 });
    }

    // 3. Log the On-Chain Transaction
    await supabaseAdmin.from('onchain_transactions').insert([{
      checkout_session_id: session.id,
      merchant_id: session.merchant_id,
      signature: transactionSignature,
      slot: verification.slot,
      block_time: verification.blockTime ? new Date(verification.blockTime * 1000).toISOString() : null,
      amount: session.amount,
      fee_lamports: verification.fee,
      status: 'finalized'
    }]);

    // 4. Mark Session as Completed
    await supabaseAdmin
      .from('checkout_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // 5. Dispatch Webhook to the Merchant
    await dispatchWebhookEvent({
      merchantId: session.merchant_id,
      environment: session.environment,
      eventType: 'checkout.session.completed',
      payload: {
        sessionId: session.id,
        amount: session.amount,
        currency: session.currency,
        referenceId: session.reference_id,
        customerEmail: session.customer_email,
        transactionSignature,
      },
    });

    return NextResponse.json({ success: true, status: 'completed' });
  } catch (error: any) {
    console.error('Verification Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
