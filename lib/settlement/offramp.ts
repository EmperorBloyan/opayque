export interface PayoutRequest {
  merchantId: string;
  amount: number;
  currency: string;
  bankAccountId: string;
}

export interface PayoutResponse {
  success: boolean;
  data?: {
    payoutId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    estimatedArrival: string;
  };
  error?: string;
}

const IS_SANDBOX = process.env.NEXT_PUBLIC_NETWORK !== 'mainnet';

export async function initiateFiatPayout(req: PayoutRequest): Promise<PayoutResponse> {
  if (!req.merchantId || req.amount <= 0 || !req.bankAccountId) {
    return { success: false, error: "Invalid payout parameters" };
  }

  try {
    if (IS_SANDBOX) {
      await new Promise(r => setTimeout(r, 900));
      return {
        success: true,
        data: {
          payoutId: `po_${Date.now()}`,
          status: 'processing',
          estimatedArrival: new Date(Date.now() + 172800000).toISOString(),
        }
      };
    }
    throw new Error("Production off-ramp not configured");
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
