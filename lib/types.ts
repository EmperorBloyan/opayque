// lib/types.ts

/**
 * Represents a registered recipient in the Opayque ecosystem.
 */
export interface Endpoint {
  id: string;
  name: string;
  address: string;
  category: "Staff" | "Cause" | "Tips";
  image?: string;
  createdAt: number;
}

/**
 * Represents a paired hardware terminal in the fleet.
 */
export interface Terminal {
  id: string;
  label: string;
  status: "online" | "offline";
  lastSeen: number;
  accessCode?: string;
  isActive?: boolean;
  lastLoginAt?: number | null;
}

/**
 * Represents the client-side state of the merchant vault authorization flow.
 */
export interface VaultAuthState {
  status: "idle" | "authorizing" | "authenticated" | "error";
  message: string | null;
}

export type EndpointCategory = "Staff" | "Cause" | "Tips";

export type PaymentStatus =
  | "created"
  | "pending_signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "expired";

export type ReconciliationStatus = "pending" | "matched" | "mismatch" | "not_found";

export interface PaymentLedgerRow {
  id: string;
  merchant_id: string;
  terminal_id: string | null;
  checkout_session_id: string | null;
  amount: number;
  amount_base_units: number | null;
  mint: string;
  token_symbol: string;
  sender_address: string | null;
  recipient_address: string;
  signature: string | null;
  status: PaymentStatus;
  memo: string | null;
  environment: "sandbox" | "mainnet";
  idempotency_key: string | null;
  payload_hash: string | null;
  failed_reason: string | null;
  confirmed_at: string | null;
  reconciliation_status: ReconciliationStatus;
  last_reconciled_at: string | null;
  reconciliation_notes: string | null;
  created_at: string;
  updated_at: string;
}