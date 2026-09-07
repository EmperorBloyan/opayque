# Production Checklist

Evidence must be attached before checking an item. An unchecked item is not a pass.

## Security

- [ ] RLS verified against a real Supabase project
- [ ] Cross-tenant SELECT/INSERT/UPDATE/DELETE isolation verified
- [ ] Secret scan clean
- [ ] API authorization and environment binding verified
- [ ] Terminal authorization and revocation verified
- [ ] Replay protection verified
- [ ] Distributed rate limiting verified in production

## Payments

- [ ] Database-backed idempotency verified under concurrency
- [ ] Base-unit amount precision and overflow tests pass
- [ ] State machine and database transition enforcement verified
- [ ] Sender, recipient, mint, amount, and finality transaction verification verified
- [ ] Duplicate settlement prevented by constraints and tests
- [ ] Reconciliation detects mismatches without rewriting history

## Privacy

- [ ] Private path verified with the production provider
- [ ] No public fallback after private failure
- [ ] Privacy threat model reviewed
- [ ] Provider and RPC visibility assumptions documented

## Blockchain

- [ ] Anchor tests pass
- [ ] Token movement tests pass
- [ ] Authority and signer checks pass
- [ ] PDA derivation checks pass
- [ ] Nonce/replay tests pass
- [ ] Mainnet program, mint, RPC, and upgrade authority configuration verified

## Operations

- [ ] Cron authentication and duplicate execution safety verified
- [ ] Durable webhook retry and replay handling verified
- [ ] Structured observability and alerting verified
- [ ] Backup and recovery strategy tested
- [ ] Secret rotation tested, including rejection of old credentials
- [ ] Rollback procedure tested

## Current Evidence

- Unit tests are available locally for selected lifecycle, auth, terminal, rate-limit, and provider boundaries.
- Remote RLS, production blockchain, provider privacy, deployment secrets, and recovery evidence are not available from source inspection alone.
- Until those checks have evidence, the release status is **FAIL / NOT PRODUCTION READY**.
