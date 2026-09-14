export type PendingPaymentPhase = "building" | "awaiting_wallet" | "submitted";

export interface PendingPayment {
  intentId: string;
  sender: string;
  recipient: string;
  amount: number;
  phase: PendingPaymentPhase;
  signature?: string;
  startedAt: number;
}

const STORAGE_KEY = "opayque.pending-private-payment";

export function readPendingPayment(): PendingPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value as PendingPayment : null;
  } catch {
    return null;
  }
}

export function writePendingPayment(payment: PendingPayment): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payment));
}

export function clearPendingPayment(intentId?: string): void {
  if (typeof window === "undefined") return;
  const pending = readPendingPayment();
  if (!intentId || pending?.intentId === intentId) window.localStorage.removeItem(STORAGE_KEY);
}