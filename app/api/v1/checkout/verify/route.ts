import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatchWebhook } from '@/lib/webhooks';

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'finalized');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transactionSignature = typeof body?.transactionSignature === 'string' ? body.transactionSignature.trim() : '';
    const merchantId = typeof body?.merchantId === 'string' ? body.merchantId.trim() : '';
    const amount = typeof body?.amount === 'number' ? body.amount : Number(body?.amount);

    if (!transactionSignature || !merchantId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid verification payload' }, { status: 400 });
    }

    // 1. Verify the transaction on the Solana blockchain
    const tx = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) {
      return NextResponse.json({ error: 'Transaction failed or not found on-chain' }, { status: 400 });
    }

    // 2. Fetch the merchant's configured webhook URL from Supabase
    const supabase = createSupabaseServerClient(request);
    const { data: developerData, error } = await supabase
      .from('developer_projects')
      .select('webhook_url, secret_api_key_hash')
      .eq('user_id', merchantId)
      .single();

    if (error || !developerData?.webhook_url) {
      return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 404 });
    }

    // 3. Dispatch the success event to the merchant
    const payload = {
      event: 'transaction.success',
      data: {
        transactionId: transactionSignature,
        amount: amount,
        currency: 'USDC', 
        timestamp: new Date().toISOString(),
      }
    };

    const webhookSuccess = await dispatchWebhook(
      developerData.webhook_url, 
      payload, 
      developerData.secret_api_key_hash
    );

    if (!webhookSuccess) {
       // Note: In a production environment, you would push this to a retry queue
       console.error('Webhook dispatch failed for tx:', transactionSignature);
    }

    return NextResponse.json({ success: true, message: 'Transaction verified and webhook dispatched' });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
