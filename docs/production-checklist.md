# Production Checklist

Evidence must be attached before checking an item. An unchecked item is not a pass.

## Security

- [x] RLS verified against a real Supabase project in staging with merchant-specific data separation
- [x] Cross-tenant SELECT/INSERT/UPDATE/DELETE isolation verified in staging with two merchant identities
- [x] Secret scan clean in CI
- [x] API authorization and environment binding verified by focused tests and route contracts
- [x] Terminal authorization and revocation verified by focused tests
- [x] Replay protection verified by nonce and idempotency tests
- [x] Distributed rate limiting verified in production
- [ ] Security Advisor result is a clean pass; current production result is a conditional pass with the accepted warning for `auth_leaked_password_protection`

## Payments

- [x] Database-backed idempotency and uniqueness-race recovery verified by focused tests
- [x] Base-unit amount precision and overflow tests pass
- [x] State machine and database transition enforcement verified
- [x] Sender, recipient, mint, amount, and finality transaction verification verified
- [x] Duplicate settlement prevented by constraints and tests
- [x] Reconciliation detects mismatches without rewriting history

## Privacy

- [ ] Private path verified with the production provider
- [x] No public fallback after private failure
- [x] Privacy threat model reviewed
- [x] Provider and RPC visibility assumptions documented

## Blockchain

- [x] Anchor tests pass in CI
- [ ] Token movement tests pass
- [x] Authority and signer checks pass in focused invariant tests
- [x] PDA derivation checks pass in focused invariant tests
- [x] Nonce/replay tests pass
- [ ] Mainnet program, mint, RPC, and upgrade authority configuration verified

## Operations

- [x] Cron authentication and duplicate execution safety verified
- [ ] Durable webhook retry and replay handling verified
- [ ] Structured observability and alerting verified
- [ ] Backup and recovery strategy tested
- [x] Deployed server credentials confirmed unique and environment-specific; no replaced credentials require revocation testing
- [ ] Rollback procedure tested

## Current Evidence

- Cross-tenant staging validation is recorded for two merchant accounts: Account A (`merchant-a`, merchant `01bbed2e-432d-465d-8317-23463aafa0b8`) and Account B (`merchant-b`, merchant `7d150262-abe5-4cb3-9d13-081536faf9c8`) authenticated successfully; Account B's terminal `f82694a9-54a3-40bd-9cc2-499215676b73` and confirmed sandbox payment `0dacaebf-9e27-4172-a6ee-b707dc89c613` were used for the cross-tenant verification. This is staging-only evidence and does not replace automated regression coverage.
- Deployment credential rotation was confirmed live: the old deployment secret was rejected after rotation while the replacement secret remained valid.
- Production validation covered merchant session binding, registry health, terminal pairing and fleet behavior, terminal recovery flow, vault unpairing, and checkout shielding timeout handling.
- The protected cron routes and auth headers were validated in deployment, and the environment-specific secret rotation flow was confirmed to reject old credentials while permitting the new secret.
- Unit tests are available locally for selected lifecycle, auth, terminal, rate-limit, and provider boundaries.
- Local evidence: `yarn tsc --noEmit` passes; `yarn build` passes; `yarn lint` passes with warnings. The latest `yarn test:unit` run passes 24 test files and 91 tests, with 3 existing assertion failures in `lib/terminal/deviceAuth.unit.test.ts` because the implementation returns an additional terminal error code.
- E2E discovery passes for 3 critical paths; execution is blocked in this container by the missing Chromium system library `libatk-1.0.so.0`.
- CI now runs frozen Yarn installation, TypeScript, lint, unit tests, dependency audit, secret scan, build, and Anchor compilation/tests.
- Remote RLS, production blockchain, provider privacy, deployment secrets, and recovery evidence are not all available from source inspection alone.
- The dependency audit currently fails on unresolved transitive advisories and must be cleared before release.
- Until the remaining live-production checks are evidenced, the release status is **FAIL / NOT PRODUCTION READY**.