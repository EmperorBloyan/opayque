export type PayoutStatus = "pending" | "processing" | "completed" | "failed";

export interface InitiateFiatPayoutInput {
  merchantId: string;
  amount: number;
  currency: string;
  bankAccountId: string;
}

export interface PayoutRecord {
  id: string;
  merchantId: string;
  amount: number;
  currency: string;
  bankAccountId: string;
  status: PayoutStatus;
  note: string;
  createdAt: string;
}

export interface OfframpConfig {
  sandboxMode: boolean;
  defaultFeeBps: number;
  minPayoutAmount: number;
}

export const OFFRAMP_CONFIG: OfframpConfig = {
  sandboxMode: true,
  defaultFeeBps: 250,
  minPayoutAmount: 10,
};

function createPayoutRecord(input: InitiateFiatPayoutInput, status: PayoutStatus, note: string): PayoutRecord {
  return {
    id: `payout-${Math.random().toString(36).slice(2, 10)}`,
    merchantId: input.merchantId,
    amount: input.amount,
    currency: input.currency,
    bankAccountId: input.bankAccountId,
    status,
    note,
    createdAt: new Date().toISOString(),
  };
}

export async function initiateFiatPayout(input: InitiateFiatPayoutInput): Promise<PayoutRecord> {
  if (input.amount < OFFRAMP_CONFIG.minPayoutAmount) {
    return createPayoutRecord(input, "failed", "Payout amount is below the sandbox minimum");
  }

  if (OFFRAMP_CONFIG.sandboxMode) {
    return createPayoutRecord(input, "processing", "Sandbox off-ramp order queued for settlement");
  }

  return createPayoutRecord(input, "pending", "Live payout order submitted");
}

export async function getPayoutStatus({ payoutId }: { payoutId: string }): Promise<{ payoutId: string; status: PayoutStatus; note: string }> {
  return {
    payoutId,
    status: "completed",
    note: "Sandbox payout completed successfully",
  };
}
