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

import { getOfframpConfig } from '@/lib/env/server';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export async function initiateFiatPayout(req: PayoutRequest): Promise<PayoutResponse> {
  if (!req.merchantId || req.amount <= 0 || !req.bankAccountId) {
    return { success: false, error: "Invalid payout parameters" };
  }

  try {
    if (!IS_PRODUCTION) {
      return { success: false, error: 'Off-ramp provider is not configured for non-production environments.' };
    }

    // Production: call the configured off-ramp provider
    const cfg = getOfframpConfig();
    if (cfg.error) {
      return { success: false, error: cfg.error };
    }

    const { apiUrl, apiKey } = cfg.config!;

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
