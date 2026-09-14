import { getOfframpConfig } from "@/lib/env/server";

export type OfframpStatus = "not_configured" | "pending" | "processing" | "completed" | "failed";

export interface CreatePayoutParams {
  merchantId: string;
  amountUsdc: number;
  destinationRef: string;
  providerCustomerId?: string;
}

export interface PayoutResult {
  success: boolean;
  status: OfframpStatus;
  payoutId: string | null;
  message: string;
}

export interface OfframpProvider {
  readonly name: "null" | "bridge";
  isConfigured(): boolean;
  createPayout(params: CreatePayoutParams): Promise<PayoutResult>;
  getPayoutStatus(id: string): Promise<PayoutResult>;
}

export class NullOfframpProvider implements OfframpProvider {
  readonly name = "null" as const;

  isConfigured() {
    return false;
  }

  async createPayout(): Promise<PayoutResult> {
    return { success: false, status: "not_configured", payoutId: null, message: "Fiat payouts are handled by an external partner. No partner is configured." };
  }

  async getPayoutStatus(): Promise<PayoutResult> {
    return { success: false, status: "not_configured", payoutId: null, message: "Fiat payouts are handled by an external partner. No partner is configured." };
  }
}

export class BridgeOfframpProvider implements OfframpProvider {
  readonly name = "bridge" as const;

  constructor(private readonly config: { apiUrl: string; apiKey: string }) {}

  isConfigured() {
    return Boolean(this.config.apiUrl && this.config.apiKey);
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    const response = await fetch(`${this.config.apiUrl.replace(/\/$/, "")}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": this.config.apiKey },
      body: JSON.stringify({
        on_behalf_of: params.merchantId,
        amount: params.amountUsdc.toFixed(6),
        source_currency: "usdc",
        destination_currency: "usd",
        destination_payment_rail: "external_account",
        external_account_id: params.destinationRef,
        customer_id: params.providerCustomerId,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.id !== "string") {
      return { success: false, status: "failed", payoutId: null, message: "External fiat payout partner rejected the payout." };
    }
    return { success: true, status: normalizeOfframpStatus(payload.status), payoutId: payload.id, message: "Payout accepted by the external partner." };
  }

  async getPayoutStatus(id: string): Promise<PayoutResult> {
    const response = await fetch(`${this.config.apiUrl.replace(/\/$/, "")}/transfers/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json", "Api-Key": this.config.apiKey },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.id !== "string") {
      return { success: false, status: "failed", payoutId: id, message: "Unable to read payout status from the external partner." };
    }
    const status = normalizeOfframpStatus(payload.status);
    return { success: status !== "failed", status, payoutId: payload.id, message: `External payout status: ${status}.` };
  }
}

function normalizeOfframpStatus(value: unknown): OfframpStatus {
  const status = String(value || "pending").toLowerCase();
  if (status === "completed" || status === "complete") return "completed";
  if (status === "processing" || status === "in_progress") return "processing";
  if (status === "failed" || status === "canceled" || status === "cancelled") return "failed";
  return "pending";
}

export function getOfframpProvider(): OfframpProvider {
  const config = getOfframpConfig();
  return config.config ? new BridgeOfframpProvider(config.config) : new NullOfframpProvider();
}

export async function initiateFiatPayout(params: CreatePayoutParams): Promise<PayoutResult> {
  if (!params.merchantId || !Number.isFinite(params.amountUsdc) || params.amountUsdc <= 0 || !params.destinationRef) {
    return { success: false, status: "failed", payoutId: null, message: "Invalid external payout parameters." };
  }
  return getOfframpProvider().createPayout(params);
}
