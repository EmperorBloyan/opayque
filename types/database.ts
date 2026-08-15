export interface MerchantRecord {
  id: string;
  wallet_address: string;
  merchant_name: string;
  merchant_logo?: string | null;
  secondary_email?: string | null;
  settlement_wallet_address?: string | null;
  tee_enforcement_enabled?: boolean | null;
  api_access_status?: 'pending' | 'active' | 'revoked' | null;
  created_at: string;
}

export interface MerchantBankAccountRecord {
  id: string;
  merchant_id: string;
  iban: string;
  routing: string;
  auto_settle: boolean;
  terms_accepted: boolean;
  created_at: string;
}

export interface TerminalRecord {
  id: string;
  merchant_id: string;
  terminal_label: string;
  device_token: string;
  status: string;
  last_active: string;
}

export interface TransactionRecord {
  id: string;
  merchant_id: string;
  terminal_id: string | null;
  signature: string | null;
  token_symbol: string;
  amount: number;
  status: string;
  payload_hash: string | null;
  created_at: string;
}

export interface SettlementRecord {
  id: string;
  merchant_id: string;
  payout_id: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  created_at: string;
}
