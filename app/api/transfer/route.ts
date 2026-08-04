import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAGICBLOCK_PAYMENTS_API = process.env.PAYMENTS_API_URL || 'https://payments.magicblock.app';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sender, recipient, amount, mint, private: isPrivate, merchant_id } = body as {
      sender?: string;
      recipient?: string;
      amount?: number;
      mint?: string;
      private?: boolean;
      merchant_id?: string;
    };

    if (!sender || !recipient || typeof amount !== 'number' || !mint) {
      return NextResponse.json(
        { error: 'Missing required transfer parameters (sender, recipient, amount, mint)' },
        { status: 400 }
      );
    }

    const teeResponse = await fetch(`${MAGICBLOCK_PAYMENTS_API}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender,
        recipient,
        amount,
        mint,
        private: isPrivate ?? true,
      }),
    });

    const teeData = await teeResponse.json().catch(() => ({}));

    if (!teeResponse.ok) {
      return NextResponse.json(
        { error: teeData.message || teeData.error || 'MagicBlock TEE rejected the request' },
        { status: teeResponse.status }
      );
    }

    if (!teeData.transaction || typeof teeData.transaction !== 'string') {
      return NextResponse.json(
        { error: 'MagicBlock TEE returned an invalid transaction payload' },
        { status: 502 }
      );
    }

    if (merchant_id) {
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
      transaction: teeData.transaction,
    });
  } catch (error: unknown) {
    console.error('Transfer API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
