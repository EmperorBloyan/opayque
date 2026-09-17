# Opayque Anchor Program

Program ID: `B7j1xVowZAT2zV3bF3TPbV56hEtL1NNhFV2UVRMQR1dS`

## Protocol accounts

- `ProtocolConfig`, PDA `protocol_config`: protocol admin, circuit-breaker state, and bump.
- `MerchantVault`, PDA `merchant_vault + merchant authority`: merchant authority, merchant wallet, fee basis points, token decimals, and aggregate collected balance.
- `TreasuryAccount`, PDA `opayque_treasury + merchant authority`: protocol fee authority and aggregate fee balance.
- `TerminalNonce`, PDA `terminal_nonce + terminal id + merchant authority`: one-time terminal nonce, expiry, replay state, and the most recent memo.
- `PaymentReceipt`, PDA `payment_receipt + merchant authority + nonce`: immutable per-payment record containing payer, gross amount, fee, merchant amount, nonce, timestamp, and memo hash.

## Instructions

- `initialize_protocol(admin)`: initializes the protocol PDA and sets the circuit-breaker authority.
- `toggle_circuit_breaker(paused)`: admin-only pause/unpause for payment processing.
- `initialize_merchant_vault(fee_bps, merchant, token_decimals)`: creates the merchant vault and protocol treasury PDAs. Fees are capped at 1000 basis points.
- `register_terminal_nonce(terminal_id, nonce, expires_at)`: merchant-authorized registration of a future one-time payment nonce.
- `process_payment(amount, nonce, memo)`: verifies the circuit breaker, nonce, expiry, token accounts, and fee cap; transfers merchant funds and protocol fees; updates aggregates; creates a durable `PaymentReceipt`; and emits `PaymentSettled`.
- `withdraw_vault_funds(amount)`: merchant-authorized withdrawal from the merchant token account with checked aggregate-balance accounting.

Payment receipt PDAs are additive state. Existing merchant vault and treasury accounts remain valid; callers invoking `process_payment` must include the new receipt account so each payment is independently auditable.
