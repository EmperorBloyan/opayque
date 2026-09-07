# Opayque Production Readiness

## 1. Architecture Summary

Opayque is a Next.js App Router application with browser merchant, terminal, checkout, and developer surfaces. Supabase Auth provides merchant sessions; Supabase/Postgres stores merchants, terminals, credentials, checkout sessions, payment ledger records, webhook configuration, and operational state. Server routes use the Supabase service role for privileged workflows and the SSR client for session-bound requests.

The payment lifecycle is intended to be:

`Merchant -> endpoint/terminal/API credential -> checkout/payment intent -> private transaction construction -> wallet signature/broadcast -> independently verified Solana settlement -> immutable-ish ledger state -> webhook -> reconciliation`.

Solana is the settlement network. MagicBlock is the configured private transaction builder. The Anchor program contains merchant vault, terminal nonce, payment receipt, withdrawal, and circuit-breaker primitives, but the HTTP payment confirmation path also verifies transactions directly through Solana RPC.

## 2. Critical Components

- **Application/control plane:** Next.js pages, API routes, middleware, and server libraries.
- **Database:** Supabase Postgres with migrations, foreign keys, uniqueness constraints, and RLS policies.
- **Authentication:** Supabase sessions for merchants, hashed API keys for `/api/v1`, and hashed terminal device tokens for terminal routes.
- **Payment system:** Checkout sessions and the `payment_ledger` payment intent/settlement record, with lifecycle states `created`, `pending_signature`, `submitted`, `confirmed`, `failed`, and `expired`.
- **Blockchain layer:** `@solana/web3.js`, RPC health selection, transaction construction, confirmation, and transaction verification.
- **Privacy provider:** MagicBlock private SPL transfer construction. The server requires a provider response marked private at the application boundary and has no public fallback.
- **Terminal system:** Merchant-authorized pairing, device token authentication, terminal-scoped payment creation and settlement.
- **Webhook system:** Merchant webhook configuration, signed event payloads, QStash/direct delivery, and delivery logs.
- **Reconciliation:** Cron route that checks settlement signatures and records reconciliation state.
- **Scheduled jobs:** Expiry, reconciliation, and optional settlement/off-ramp jobs protected by `CRON_SECRET`.

## 3. Security Boundaries

- Browser and wallet clients are untrusted and may request transactions but do not receive server secrets.
- Merchant sessions bind dashboard access to `auth.users.id` and a merchant row.
- API credentials bind requests to a merchant, environment, and credential status.
- Terminal credentials bind requests to a terminal and its merchant.
- Payment records must derive merchant, recipient, token, and amount from server-side intent state, never from a client claim.
- Supabase service-role access bypasses RLS and is restricted to server-only code paths.
- MagicBlock and RPC are external dependencies. Failure must not be converted into an insecure public settlement.
- Cron and provider webhooks are separate machine-to-machine trust boundaries and require independent authentication.

## 4. Current Risks

### CRITICAL

- No critical application-code issue is currently known from the completed local review. Live database, chain, provider, and deployment evidence remains outstanding.

### HIGH

- Live Supabase RLS isolation, Solana settlement verification, and private-provider behavior remain unverified outside this repository.
- Dependency audit findings and deployment-level secret/recovery validation remain unresolved release gates.

### MEDIUM

- Some UI lint warnings remain for image optimization and React hook dependency hygiene.
- The expiry and reconciliation jobs still require live multi-worker validation against Supabase concurrency semantics.
- CI cannot prove live RLS, blockchain settlement, or private-provider guarantees from source alone.

### LOW

- Some server modules still use broad `any` values for database rows and provider payloads, which makes invariant enforcement harder to audit.
- Health/readiness behavior is present, but production dependency evidence and alert thresholds are not encoded in CI or deployment checks.

## 5. Completed Fixes

- Repaired the Yarn lockfile and restored a reproducible local dependency install.
- Added database-backed payment ledger/session contracts, uniqueness indexes, lifecycle enforcement, immutable payment identity fields, and read-only merchant RLS access for financial records.
- Applied exact base-unit amount parsing across payment creation, transfer construction, token instructions, and withdrawal construction.
- Added deterministic idempotency fingerprints and uniqueness-race recovery across terminal, API session, and checkout creation.
- Tightened finalized Solana verification with exact amounts and parsed transfer instructions bound to sender/recipient/mint.
- Added reconciliation leases and mismatch-preserving verification.
- Removed checkout confirmation and sender-binding bypasses.
- Added encrypted webhook secrets, durable webhook events, authenticated delivery, timeout handling, retry state, and event idempotency.
- Centralized merchant-session and cron authorization helpers.
- Added restrictive security headers, production environment gates, CI test/security stages, and invariant tests.
- Added an explicit architecture, threat, risk, and blocker record in this document.
- Added a canonical database migration plan to align application table names and establish checkout-session/ledger integrity constraints.
- Centralized lifecycle transition rules and retained terminal-state protection.
- Hardened externally supplied payment amounts and request fingerprints in the payment creation paths.
- Tightened on-chain verification to require exact, intent-bound facts before confirmation.
- Locked the Solana webhook boundary behind an authenticated provider signature.
- Added focused unit tests for lifecycle, amount, idempotency, authorization, and verification invariants.
- Applied response security headers consistently in middleware, including redirect responses.
- Bound the Solana provider webhook to an existing payment intent with exact merchant, recipient, mint, and amount matching; it can no longer create arbitrary ledger records.
- Required private transfer construction to use an existing payment ledger intent and match its immutable recipient and mint.
- Added explicit terminal settlement recipient binding and merchant ownership checks for offramp status.
- Added middleware security-header regression coverage to the configured unit-test suite.

Items in this section are only considered complete when the corresponding migration/code and validation command are present in the repository.

## 6. Remaining Production Blockers

- A real Supabase environment must apply every migration and execute authenticated-client cross-tenant RLS tests. This repository cannot prove remote RLS behavior without configured database credentials.
- Playwright tests are discoverable but require the container's Chromium system dependency `libatk-1.0.so.0`; browser execution is blocked until the image installs Playwright Linux dependencies.
- The dependency audit still reports high/critical transitive findings, including packages that require a Next.js major upgrade or have no upstream patch. These require an isolated dependency-upgrade project and compatibility testing.
- Webhook secret migration requires rotating existing webhook configurations because old rows contain hashes but not decryptable secret ciphertext.
- Solana confirmation and reconciliation require an integration environment with known transactions for the configured network. Unit tests cannot prove RPC/provider behavior.
- MagicBlock privacy guarantees remain provider-dependent. The exact provider contract, operator visibility, and production failure behavior must be validated with the production account and documented evidence.
- Anchor deployment authority, upgrade policy, devnet/mainnet addresses, and malicious-input tests require an Anchor/Rust toolchain and a configured validator.
- Production secrets, rate-limit namespace isolation, webhook delivery retries, alerting, backups, and recovery drills require deployment-level verification.

**Current readiness conclusion: NOT PRODUCTION READY until these blockers are evidenced.**
