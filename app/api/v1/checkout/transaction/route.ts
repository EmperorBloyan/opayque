import { NextResponse } from 'next/server';

/**
 * @route POST /api/v1/checkout/transaction
 * @description Compiles the atomic multi-instruction transaction payload for the Solana runtime.
 * Enforces the protocol-level fee split (99.5% Merchant / 0.5% Opayque).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      session_id, 
      customer_wallet_address, 
      merchant_wallet_address, 
      amount_usdc 
    } = body;

    // 1. Validate Required Payload Parameters
    if (!session_id || !customer_wallet_address || !merchant_wallet_address || !amount_usdc) {
      return NextResponse.json(
        { 
          error: 'BAD_REQUEST',
          message: 'Missing required parameters: [session_id, customer_wallet_address, merchant_wallet_address, amount_usdc]'
        },
        { status: 400 }
      );
    }

    // 2. Cryptographic & Protocol Constants
    const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const OPAYQUE_REVENUE_WALLET = 'OpayqueFeeSplitRevenueWallet111111';
    const USDC_DECIMALS = 6;
    
    // 3. Calculate Atomic Protocol Split (Precision Math)
    // Convert float USDC amount to integer base units (e.g., 15.00 USDC -> 15,000,000 units)
    const totalBaseUnits = Math.round(Number(amount_usdc) * Math.pow(10, USDC_DECIMALS));
    
    // Merchant receives exactly 99.5%
    const merchantBaseUnits = Math.floor(totalBaseUnits * 0.995);
    // Protocol retains 0.5% remainder
    const protocolBaseUnits = totalBaseUnits - merchantBaseUnits;

    // 4. Construct Transaction Instruction Metadata
    // Note: In a full production environment, you would use @solana/web3.js here 
    // to serialize an actual base64 encoded transaction buffer. For this API, 
    // we return the structured metadata for the client-side SDK to build and sign.
    return NextResponse.json(
      {
        success: true,
        data: {
          session_id: session_id,
          network_cluster: 'mainnet-beta',
          asset_mint: USDC_MAINNET_MINT,
          instructions: {
            fee_payer: customer_wallet_address,
            transfers: [
              {
                recipient: merchant_wallet_address,
                amount_base_units: merchantBaseUnits,
                formatted_amount: (merchantBaseUnits / Math.pow(10, USDC_DECIMALS)).toFixed(6),
                allocation: '99.5%',
                label: 'MERCHANT_SETTLEMENT'
              },
              {
                recipient: OPAYQUE_REVENUE_WALLET,
                amount_base_units: protocolBaseUnits,
                formatted_amount: (protocolBaseUnits / Math.pow(10, USDC_DECIMALS)).toFixed(6),
                allocation: '0.5%',
                label: 'PROTOCOL_FEE'
              }
            ]
          },
          security_context: {
            signature_required: true,
            memo: `opayque_checkout_${session_id.replace('pi_', '')}`
          }
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[OPAYQUE_TX_ERROR] Payload Compilation Failed:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compile atomic transaction instructions.'
      },
      { status: 500 }
    );
  }
}
