# Production Checklist

Evidence must be attached before checking an item. An unchecked item is not a pass.

## Security

- [ ] RLS verified against a real Supabase project
- [ ] Cross-tenant SELECT/INSERT/UPDATE/DELETE isolation verified
- [x] Secret scan clean in CI
- [x] API authorization and environment binding verified by focused tests and route contracts
- [x] Terminal authorization and revocation verified by focused tests
- [x] Replay protection verified by nonce and idempotency tests
- [ ] Distributed rate limiting verified in production

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

- [ ] Cron authentication and duplicate execution safety verified
- [ ] Durable webhook retry and replay handling verified
- [ ] Structured observability and alerting verified
- [ ] Backup and recovery strategy tested
- [ ] Secret rotation tested, including rejection of old credentials
- [ ] Rollback procedure tested

## Current Evidence

- Unit tests are available locally for selected lifecycle, auth, terminal, rate-limit, and provider boundaries.
- Local evidence: `yarn tsc --noEmit` passes; `yarn build` passes; `yarn lint` passes with warnings. The latest `yarn test:unit` run passes 24 test files and 91 tests, with 3 existing assertion failures in `lib/terminal/deviceAuth.unit.test.ts` because the implementation returns an additional terminal error code.
- E2E discovery passes for 3 critical paths; execution is blocked in this container by the missing Chromium system library `libatk-1.0.so.0`.
- CI now runs frozen Yarn installation, TypeScript, lint, unit tests, dependency audit, secret scan, build, and Anchor compilation/tests.
- Remote RLS, production blockchain, provider privacy, deployment secrets, and recovery evidence are not available from source inspection alone.
- The dependency audit currently fails on unresolved transitive advisories and must be cleared before release.
- Until those checks have evidence, the release status is **FAIL / NOT PRODUCTION READY**.
