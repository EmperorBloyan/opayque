import { NextResponse } from 'next/server';

/**
 * @route POST /api/v1/sessions
 * @description Initializes a secure payment intent for the Opayque checkout module.
 * Expected to be called from the merchant's secure backend environment.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate Request via Secret Key Header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer osk_live_')) {
      return NextResponse.json(
        { 
          error: 'UNAUTHORIZED_ACCESS',
          message: 'Missing or invalid live secret API key. Must use Bearer token format.'
        },
        { status: 401 }
      );
    }

    // 2. Parse & Validate Incoming Payload
    const body = await request.json();
    const { order_id, amount_fiat, currency = 'USD', metadata = {} } = body;

    if (!order_id || !amount_fiat) {
      return NextResponse.json(
        { 
          error: 'BAD_REQUEST',
          message: 'Missing required payload parameters: [order_id, amount_fiat]'
        },
        { status: 400 }
      );
    }

    // 3. Process Fiat-to-Crypto Oracle Conversion (Simulated 1:1 USDC Peg)
    const amountCrypto = Number(amount_fiat).toFixed(4);
    
    // Generate Cryptographically Secure Intent ID
    const intentHash = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const paymentIntentId = `pi_${intentHash}`;

    // 4. Retrieve Merchant Environment Configuration (Mocked for routing)
    const merchantDestinationWallet = '7xKXtg2b...3b9Y'; 
    const opayqueRevenueWallet = 'OpayqueFeeSplitRevenueWallet111111';

    // 5. Construct and Return the Standardized Payload
    return NextResponse.json(
      {
        success: true,
        data: {
          session_id: paymentIntentId,
          order_id: order_id,
          pricing: {
            fiat_amount: Number(amount_fiat),
            currency: currency.toUpperCase(),
            settlement_asset: 'USDC',
            settlement_amount: Number(amountCrypto)
          },
          routing: {
            merchant_destination: merchantDestinationWallet,
            fee_split: {
              merchant_share: '99.5%',
              network_fee: '0.5%'
            }
          },
          status: 'AWAITING_CLIENT_SIGNATURE',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15-minute expiry
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[OPAYQUE_API_ERROR] Session Generation Failed:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compile secure payment intent session.'
      },
      { status: 500 }
    );
  }
}
