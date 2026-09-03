# Security and Compliance

Report suspected vulnerabilities privately to the repository owner before opening a public issue. Include the affected route or file, reproduction steps, impact, and a minimal proof of concept. Do not include real API keys, wallet private keys, service-role credentials, customer data, or transaction secrets in reports.

For urgent production incidents, rotate the affected credential immediately, disable the related Vercel environment variable or endpoint, and preserve sanitized logs and transaction signatures for investigation. Secret rotation must include revoking the old API key or relayer key, creating a replacement, updating only the intended Preview or Production environment, redeploying, and verifying the old credential is rejected.

Opayque is non-custodial. Never submit wallet private keys, `RELAYER_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, MagicBlock keys, Upstash tokens, off-ramp keys, or Sentry auth tokens to the browser or an issue tracker.

## Trust boundaries

- **Client and wallet:** untrusted browser code and user-controlled wallet signatures. The client may request a transaction, but never receives server signing keys.
- **Next.js server:** authenticates sessions and API keys, validates payment intents, binds merchants to wallets, applies rate limits, and calls upstream services. Server environment variables are never serialized to responses.
- **Supabase:** persistent merchant, key, webhook, terminal, intent, and transaction data. RLS policies scope dashboard access through `auth.uid()` and merchant ownership.
- **MagicBlock TEE:** private transfer transaction builder. Private payments must use `visibility: "private"`; upstream failure is never converted to a public transfer.
- **Solana RPC/network:** external transport and final settlement layer. RPC endpoints are probed and selected by health; calls have retries and deadlines.

## Key assets

Wallet private keys, `RELAYER_PRIVATE_KEY`, `MAGICBLOCK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, Upstash credentials, off-ramp credentials, webhook signing secrets, API key material, payment intent data, and merchant settlement addresses.

## Main threats and controls

- **Cross-merchant access:** authenticated queries use `auth_user_id`; ownership helpers compare wallet addresses; Supabase RLS scopes merchant-owned rows.
- **Credential theft:** API keys are stored as hashes in `api_keys`; raw secrets are returned only once and are not stored in `merchants` or returned by merchant endpoints. Revoked keys are rejected.
- **Environment confusion:** `osk_test_` and `osk_live_` keys must match the Solana cluster. Checkout sessions retain their environment, and production mainnet requires explicit RPC, MagicBlock, relayer, and Supabase configuration.
- **Private-path downgrade:** transfer construction always requests `visibility: "private"` and returns `mode: "private"`. Circuit-open or upstream errors fail closed.
- **Replay and abuse:** payment intents are checked for payable status, amount, mint, recipient, and identity. Transfer, session, key creation, pairing, relayer, compliance, and webhook configuration routes use strict limits.
- **Endpoint abuse and SSRF:** webhook destinations are merchant-bound and must be HTTPS. Do not fetch arbitrary merchant URLs without allowlisting and egress controls.
- **RPC and upstream outages:** probes, timeout-bounded calls, transient retries, confirmation deadlines, and MagicBlock circuit breaking prevent indefinite hangs.

## Secret handling and rotation

Keep secrets only in Vercel/server environment variables or the approved secret manager. Never use `NEXT_PUBLIC_` for private credentials. Rotate a suspected credential immediately: revoke the old API or relayer key, create a replacement, update only the intended Preview or Production environment, redeploy, and verify the old credential is rejected. Preserve only sanitized logs and transaction signatures for incident response.

## Deployment checklist

Before enabling mainnet, verify dedicated RPC credentials, the configured USDC mint and cluster, MagicBlock authentication, relayer funding and key custody, Supabase migrations/RLS, Upstash fail-closed rate limiting, webhook signing configuration, Sentry alerting, and a tested rollback. Confirm devnet and mainnet use separate API keys, webhooks, settlement records, and operational credentials.
For urgent incidents, disable the affected endpoint or environment variable, investigate with sanitized evidence, and notify affected merchants as required by the applicable compliance process.

## Deployment checklist

Before enabling mainnet, verify dedicated RPC credentials, the configured USDC mint and cluster, MagicBlock authentication, relayer funding and key custody, Supabase migrations/RLS, Upstash fail-closed rate limiting, webhook signing configuration, Sentry alerting, and a tested rollback. Confirm devnet and mainnet use separate API keys, webhooks, settlement records, and operational credentials.
