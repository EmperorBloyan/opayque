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

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export async function initiateFiatPayout(req: PayoutRequest): Promise<PayoutResponse> {
  if (!req.merchantId || req.amount <= 0 || !req.bankAccountId) {
    return { success: false, error: "Invalid payout parameters" };
  }

  try {
    if (!IS_PRODUCTION) {
      // Sandbox behaviour: fake a payout for testing
      await new Promise((r) => setTimeout(r, 900));
      return {
        success: true,
        data: {
          payoutId: `po_${Date.now()}`,
          status: 'processing',
          estimatedArrival: new Date(Date.now() + 172800000).toISOString(),
        },
      };
    }

    // Production: call the configured off-ramp provider
    const apiUrl = process.env.FIAT_OFFRAMP_API_URL_PROD;
    const apiKey = process.env.FIAT_OFFRAMP_API_KEY_PROD;
    if (!apiUrl || !apiKey) {
      throw new Error('Production off-ramp not configured (missing FIAT_OFFRAMP_API_URL_PROD or FIAT_OFFRAMP_API_KEY_PROD)');
    }

    const res = await fetch(`${apiUrl}/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Off-ramp API error');
    }

    return {
      success: true,
      data: {
        payoutId: data?.id || data?.payoutId || `po_${Date.now()}`,
        status: data?.status || 'processing',
        estimatedArrival: data?.estimatedArrival || new Date(Date.now() + 172800000).toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
