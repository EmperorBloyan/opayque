Opayque

Privacy is the prerequisite for institutional commerce.

Opayque is a non-custodial merchant settlement layer on Solana. It supports a MagicBlock private-payment path when configured, while public Solana transfers remain publicly observable.

Built for high-adoption markets where financial discretion is not optional.

The Problem

Public blockchains are excellent at settlement. They are terrible at commercial privacy.

When a merchant accepts Solana payments today:

| Exposure | Consequence |
|----------|-------------|
| Wallet balances | Competitors estimate turnover |
| Incoming transfers | Customer lists become public |
| Settlement timing | Inventory and volume patterns leak |
| Endpoint addresses | Staff and store activity is trackable |

In markets such as Nigeria, India, and other high-velocity commerce corridors, that visibility pushes serious merchants back to cash and closed rails. Opayque closes that gap: on-chain finality without on-chain surveillance of merchant operations.

The Solution

Opayque provides a privacy-oriented Vault model:

Merchants operate a private control surface (vault, registry, terminals, API keys).
Customers can pay through a MagicBlock private checkout path when the provider returns a valid private transaction.
Settlement can use the MagicBlock private transfer path when the provider returns a valid private transaction; public Solana transfers remain publicly observable.

Core idea: business accounting privacy with cryptographic settlement integrity.

Architecture

┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SURFACES                          │
│  Landing · Vault · Registry · Terminal · Developer Hub · Checkout│
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      NEXT.JS APPLICATION                         │
│  App Router · Wallet Adapter · Session Binding · API Routes      │
└───────────┬─────────────────────────────┬───────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐     ┌───────────────────────────────┐
│   SUPABASE            │     │   SOLANA + PRIVACY LAYER      │
│   Auth (email)        │     │   Devnet / Mainnet RPC        │
│   Merchants           │     │   Shielded transfer builder   │
│   Terminals           │     │   Confidential / TEE path     │
│   API keys / sessions │     │   Anchor program (settlement) │
└───────────────────────┘     └───────────────────────────────┘

Logical components

| Component | Role |
|-----------|------|
| Vault | Authenticated merchant control center |
| Registry | Endpoint identities (store / staff / channel addresses + QR) |
| Hardware Fleet | Paired POS terminals with codes, permanent unpair, refresh |
| Terminal | Cashier UI → generates pay links / QR → customer checkout |
| Shielded Checkout | Customer-facing payment surface (amount, wallet, TEE path) |
| Developer Hub | API keys, overview, RPC/terminal telemetry, embed links |
| Merchant session | Bound merchantId + settlement wallet after login |

## Transfer modes

Merchants choose a default transfer mode in their profile. Private uses the MagicBlock path and fails closed if private construction is unavailable; standard uses an explicit public Solana USDC transfer. The mode is snapshotted when a hosted checkout intent is created, so changing the merchant default does not alter in-flight payments. Customers do not choose the mode at checkout.

Payment flow (high level)

Merchant configures endpoint / terminal
        │
        ▼
QR or embed link → /checkout?address=…&name=…&amount=…
        │
        ▼
Customer connects wallet → Pay Privately
        │
        ▼
POST /api/transfer → build shielded instructions
        │
        ▼
Wallet signs → broadcast → confirm
        │
        ▼
Local activity + optional DB trail → merchant dashboard

Privacy intent: minimize public leakage of merchant operational state while preserving verifiable settlement.

Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Wallets | Solana Wallet Adapter (Phantom and compatible) |
| Auth & data | Supabase (Auth + Postgres + RLS patterns) |
| Chain | Solana (devnet-first; mainnet-ready config) |
| Privacy path | MagicBlock-oriented TEE / private transfer construction |
| Programs | Anchor (merchant / settlement primitives where present) |
| Deploy | Vercel |

Key Features

Merchant Vault
Email unlock with merchant profile hydration  
Settlement wallet binding  
Registry of payment endpoints with identity (name, category, QR)  
Terminal fleet pairing / permanent unpair / refresh codes

Shielded Checkout
Customer pay surface with fiat display + USDC settlement amount  
Wallet connect → private pay action  
Success state with countdown / return path  
Activity hooks for merchant “recent activity”  

Terminal & Embeds
POS-style amount entry  
Payment link / QR generation for endpoints  
Embed-friendly checkout URLs for e-commerce merchants  

Developer Hub
API key lifecycle (publishable / secret patterns)  
Overview cards (RPC health, terminal/MWA navigation)  
Merchant profile continuity across vault and developer layouts  

Product principles
Non-custodial** — merchants hold settlement keys  
Session-bound** — terminal and API actions require merchant context  
Mobile-aware navigation** — hard navigations where soft routing fails  
Operational privacy** — endpoints and fleet are merchant-scoped  

Repository Map (indicative)

app/
  page.tsx                 # Landing / access vault
  login/                   # Unlock Hub (email session)
  onboarding/              # First-time merchant setup
  checkout/                # Public shielded checkout
  terminal/                # Staff POS surface
  vault/
    registry/              # Endpoints + hardware fleet
    dashboard/             # Balances / activity
    checkout/              # Vault-scoped checkout variants
  developer/               # API keys, overview, quickstart
  api/
    transfer/              # Build shielded transfer tx
    v1/merchant/           # Merchant profile API
    terminal/pairing/      # Terminal pairing codes
    relayer/               # Gasless vault init helpers
components/
  ShieldedCheckout.tsx
  TerminalManager.tsx
  PairingModal.tsx
  ...
lib/
  magicblock.ts            # Transfer / TEE bridge helpers
  crypto/session.ts        # Merchant session bind/clear
  activity.ts              # Local activity feed
  supabase/                # Clients
programs/                  # Anchor (if present)

Exact paths may evolve; treat this as the architectural map, not a frozen tree.

Getting Started

Prerequisites

Node.js 18+  
Yarn or npm  
Solana CLI (optional, for program work)  
Supabase project  
Phantom (or compatible) wallet on devnet for testing  

Install

git clone https://github.com/EmperorBloyan/opayque.git
cd opayque
npm install
or: yarn

Environment

Create .env.local (never commit secrets):

App
NEXT_PUBLIC_APP_URL=http://localhost:3000

Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_FALLBACK_URL=https://your-secondary-rpc.example.com
Optional dedicated Helius / other RPC:
NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
Optional transaction priority-fee controls:
SOLANA_COMPUTE_UNIT_LIMIT=300000
SOLANA_PRIORITY_FEE_MICROLAMPORTS=1000

Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

Distributed rate limiting (required in production for transfer, relayer, and pairing APIs)
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token

MagicBlock / payments
NEXT_PUBLIC_MAGICBLOCK_API=https://payments.magicblock.app
# Optional for the currently public devnet builder; required for authenticated/private production access
MAGICBLOCK_API_KEY=your_server_only_magicblock_key

Operations
CRON_SECRET=your_server_only_cron_secret

Use a reliable RPC in production. Public free endpoints will rate-limit real checkout flows.
The MagicBlock payments endpoint currently supports unauthenticated devnet transaction building for testing, so a devnet `MAGICBLOCK_API_KEY` is not required. The server still sends the key when configured, and production/private access must use a server-only key provided by MagicBlock; never expose it with a `NEXT_PUBLIC_` prefix or commit it. Set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`, a mainnet primary and fallback RPC, the mainnet USDC mint, and the production MagicBlock endpoint/key for mainnet deployments. `/api/health` reports the active cluster and probes every configured RPC without returning credentials.
Production mainnet server paths fail configuration validation when the dedicated RPC, MagicBlock endpoint/key, relayer key, or Supabase server configuration is missing. The priority-fee variables are optional production tuning knobs; invalid values use bounded safe defaults.
Payment-critical server routes probe configured RPCs, prefer the lowest-latency healthy endpoint, and temporarily cool down failed endpoints before trying them again. `/api/health` reports cluster and RPC readiness using endpoint hosts only, never credential-bearing query strings.

Auth matrix and product boundaries

Public pages include landing, login, checkout, and pay links. Vault, developer, and onboarding pages require a Supabase merchant session. Terminal payment operations require the `x-terminal-token` device credential; fleet pairing and revocation require the merchant session. Cron routes require `CRON_SECRET`, while `/api/v1/*` uses hashed publishable or secret API keys according to endpoint scope.

Terminal pairing lifecycle: a merchant generates a code in Vault, and staff enters it on the Terminal page. Staff can use `Return Home` to navigate to the landing page without ending the paired terminal session; `Open Terminal` restores the saved device credential. Only `Unpair` in Vault removes the terminal row and invalidates access. If the terminal is already removed, bootstrap validation clears the stale local credential and requires pairing again. In development, pairing and unpairing work without Upstash credentials; production keeps these operations fail-closed until `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.

Compliance screening is selected with `COMPLIANCE_PROVIDER=null|demo|sumsub` and defaults to `null` in production. The demo provider is explicitly labelled as demo-only and is never a KYB/KYC decision. Sumsub requires `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, and `SUMSUB_WEBHOOK_SECRET`; its server-generated WebSDK token is passed to the hosted client flow and the secret never reaches the browser.

Fiat conversion is optional and external. Opayque never holds fiat or sends bank transfers. The Bridge scaffold is enabled only when `BRIDGE_API_KEY` is set (with optional `BRIDGE_API_URL` and `BRIDGE_WEBHOOK_SECRET`); otherwise settlement cron returns `not_configured` and does no work. The Vault compliance page shows both provider states and keeps crypto settlement status separate from any later partner payout.

Copy `.env.example` to your deployment secret store. Webhook endpoints are `/api/webhooks/sumsub` and `/api/webhooks/bridge`; configure each provider to sign callbacks and apply all Supabase migrations before enabling them.

Supabase schema

Apply `supabase/schema.sql` in the Supabase SQL Editor for a fresh project, then apply every file in `supabase/migrations/` in filename order. Server routes that need privileged writes use `SUPABASE_SERVICE_ROLE_KEY`; browser and authenticated merchant flows use the user session and remain subject to RLS. Never expose the service-role key or store raw API keys.

Fresh staging bootstrap

For a new Supabase project, link it first and apply the baseline before pushing the migration history. `supabase db push` only applies tracked migrations; the repository migrations depend on the baseline objects in `supabase/schema.sql`. Run `npx supabase db query --linked --file supabase/schema.sql`, then `npx supabase db push`. Verify the linked project reference before both commands. Use staging-only credentials and Solana devnet; never run these commands against the production project.

Staging status (2026-09-08)

The Supabase staging project `app-staging` (`caajooihrtzaugtddrdk`, North EU / Stockholm) has the complete repository migration history through `20260911`. Schema verification passed: all expected application tables exist, RLS is enabled, anonymous table grants are zero, owner policies do not target `PUBLIC`, and both trigger functions use `search_path = public`. HTTP smoke tests remain pending until a staging application URL and staging-only runtime credentials are deployed.

Run

npm run dev
open http://localhost:3000

Build

npm run build
npm start

Tests

`yarn test:unit` runs deterministic Vitest suites. `yarn test:coverage` runs the same suites with V8 coverage (target 80% statements for security-critical libraries before release). `yarn test:e2e` runs Playwright critical paths and requires a configured local app. `yarn tsc --noEmit` runs the full TypeScript check. `yarn anchor:idl` rebuilds the Anchor program and copies its generated IDL into `lib/idl/opayque.json`; it requires Rust and Anchor CLI.

Stack hygiene

The primary Solana stack is `@solana/web3.js` plus Anchor. Payment privacy is provider-dependent: only transactions returned by MagicBlock with `visibility: "private"` use the private path; ordinary Solana transfers are public. Merchants retain custody of signing keys. Devnet is the default and mainnet operation requires separate configuration and provider validation.

Core User Journeys

1. Merchant onboarding
Access Vault → Onboarding (or Sign In if account exists)  
Connect wallet → sign ownership → initialize vault (gasless path where available)  
Create account → merchant row + session bind  
Land in Registry / Dashboard  

2. Accept a payment
Register an endpoint or pair a terminal  
Generate QR / link with settlement address + amount  
Customer opens checkout → connects wallet → Pay Privately  
Private transfer builds through MagicBlock `/v1/spl/transfer` via `/api/transfer` → sign → confirm
Merchant activity is read from the durable database ledger through `/api/merchant/activity`; local activity storage is optional optimistic cache only.

Payment ledger operations

- Terminal and API checkout creation persist `payment_ledger` rows with idempotency support through the `Idempotency-Key` header.
- Wallet confirmation is recorded through `POST /api/v1/payments/confirm`; existing checkout verification and terminal settlement also update the ledger.
- Payment status webhooks are emitted after committed transitions (`payment.created`, `payment.submitted`, `payment.confirmed`, `payment.failed`, and `payment.expired`).
- `POST /api/cron/expire-transactions` expires stale intents, while `POST /api/cron/reconcile-payments` checks signed rows against Solana and flags mismatches without rewriting confirmed amounts.

3. Developer integration
Unlock Developer Hub  
Create API keys after profile completeness  
Create checkout session / embed HTML  
Point storefront buttons at Opayque checkout URLs  

Security & Privacy Notes

Pay Privately uses MagicBlock Private Payments (PER/TEE) with `visibility: "private"`.
The Opayque Anchor program provides vault, terminal, nonce, and accounting operations; it is not itself a confidentiality layer.
The private path hides the sender/amount/recipient relationship according to MagicBlock's privacy guarantees, while any final settlement footprint exposed by MagicBlock remains subject to its network design.
There is no automatic public-transfer fallback under the Pay Privately action.
MagicBlock or Solana RPC degradation fails closed; the private path never falls back to a public transfer.

Never** commit service-role keys or production secrets.  
Prefer email+password auth with confirmations disabled only if intentional; do not disable the email provider itself.  
Merchant session binding (merchantId) is required for terminal and many API routes—login must hydrate /api/v1/merchant.  
Checkout should timeout failed TEE/RPC builds rather than spin forever.  
Treat confidential / TEE paths as environment-sensitive: wrong RPC, mint, or incomplete confidential setup will fail transfer construction.  
RLS on Supabase tables should scope merchants to their own rows.  

See [SECURITY.md](SECURITY.md) for trust boundaries, threat mitigations, and secret rotation guidance.

Deployment

Vercel
Import the GitHub repo  
Set the same env vars as local (production values)  
Deploy production  
Point NEXT_PUBLIC_APP_URL at the production domain  

Production checklist

Readiness assessment (2026-09-08): **86/100 — ready for staging and controlled devnet use; not approved for mainnet yet.** The application builds successfully, the application controls and database hardening are present in the repository, but live Supabase, Vercel, provider, and operational checks below must be completed before a production launch.

- [x] Repository security migration is committed in `supabase/migrations/20260908_security_hardening_reproducible.sql`.
- [x] Legacy `pairing_codes` cleanup, `anon` revocation, owner-policy replacement, function search paths, and foreign-key indexing are represented in the migration.
- [x] Leaked-password protection was enabled in Supabase; re-run Security Advisor in the production project to confirm the advisory is cleared.
- [x] Focused terminal pairing tests pass locally.

- [x] `.env.example` documents public and server-only variables; service-role, relayer, cron, MagicBlock, Upstash, off-ramp, and Sentry auth credentials are server-only.
- [x] TypeScript, unit tests, and the Next production build pass locally with bounded Node memory.
- [x] `/api/health` checks the configured Solana RPC and Supabase connectivity without returning provider details.
- [x] Critical transfer, verification, relayer, and cron failures are captured by Sentry without logging request secrets.
- [ ] Configure Vercel Preview with devnet RPC/mint and Production with mainnet RPC/mint only when mainnet gates are complete.
- [ ] Verify the MagicBlock private path on devnet with a real provider response and correct send RPC.
- [ ] Run Anchor token-movement tests for payment and withdrawal in an Anchor-capable environment.
- [x] Apply and verify all Supabase migrations, including `20260908_security_hardening_reproducible.sql`, in the production project.
- [x] Configure and verify Upstash distributed rate limiting in each deployed environment.
- [x] Schedule `POST /api/cron/expire-transactions` and `POST /api/cron/reconcile-payments` with `Authorization: Bearer $CRON_SECRET`.
- [ ] Rotate all deployment secrets from their bootstrap values and confirm old credentials fail.
- [x] Compliance is documented as demo-only until a real provider is configured; fiat off-ramp is disabled unless configured.
- [ ] `yarn test:coverage` meets the release threshold for auth, terminal, ledger, webhook, rate-limit, environment, and private-transfer modules.
- [ ] Run Playwright merchant onboarding, terminal pairing/reload/bootstrap, checkout, and Developer Hub flows against mocked external services.
- [x] Verify terminal pairing creates `terminals.device_token_hash`; pairing integration tests cover fresh redemption, and terminal QR generation sends the matching `x-terminal-token`.
- [ ] Verify signed Sumsub/Bridge webhook fixtures update only provider status and never store government IDs or bank-account details.
- [x] Confirm production `COMPLIANCE_PROVIDER` is `null` by default and demo screening is rejected in production; focused provider tests cover both cases.
  
Launch decision: **NO-GO for mainnet until every unchecked item above and every unchecked post-deploy check below is completed.** A passing local build or unit suite cannot verify production secrets, Supabase advisories, provider authentication, rate-limit configuration, cron delivery, backups, or rollback.

Preview and Production environments

Use separate Vercel environment values. Preview should use `NEXT_PUBLIC_SOLANA_NETWORK=devnet`, a devnet RPC, devnet USDC, and non-production relayer/provider credentials. Production should remain disabled for mainnet merchants until every unchecked gate above is verified; when enabled, use `mainnet-beta`, a mainnet RPC, mainnet USDC, and separate rotated secrets. Never reuse Preview secrets in Production.

Post-deploy checks
- [ ] Login binds merchant session
- [ ] Registry loads without infinite “verifying”
- [ ] Terminal pairing updates fleet
- [ ] Terminal `Return Home` preserves pairing and `Open Terminal` restores access
- [ ] Vault `Unpair` permanently removes the terminal from Hardware Fleet
- [ ] Checkout does not hang on SHIELDING (error or success within timeout)
- [ ] Supabase Security Advisor is clear except for explicitly accepted findings
- [ ] Production backup/PITR restore and rollback are tested
- [ ] Old deployment credentials are rejected after rotation
[ ] Embed/checkout links resolve (no 404)  

Design Language

Opayque uses a terminal / institutional aesthetic:

Near-black surfaces, violet accents  
Dense typography for operational screens  
Clear separation between merchant control and customer checkout  

The product should feel like infrastructure, not a consumer meme wallet.

Roadmap Themes

| Horizon | Focus |
|---------|--------|
| Near | Hardened transfer path, session reliability, terminal fleet sync |
| Mid | Mainnet settlement policies, richer webhooks, multi-asset |
| Long | Full PER batch flush UX, compliance export packs, agentic commerce APIs |

Contributing

Branch from main  
Keep UI changes minimal unless intentional  
Prefer small, testable commits (auth, transfer, registry, terminal)  
Open a PR with reproduction steps for bugs  

License

Proprietary / project-defined. Confirm with the repository owner before redistribution.

Credits

Designed and engineered for real merchant privacy on Solana—  
inspired by the gap between public settlement and private commerce.

Business is personal. Financial history should remain private.

Quick links

| Resource | URL |
|----------|-----|
| Repository | https://github.com/EmperorBloyan/opayque |
| Production app | Configure via your Vercel domain |

Opayque — Shielded merchant infrastructure for Solana.