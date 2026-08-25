Opayque

Privacy is the prerequisite for institutional commerce.

Opayque is a shielded merchant settlement layer on Solana. It lets businesses accept on-chain payments without turning every sale into a public ledger of revenue, customers, and cash flow—while remaining non-custodial, composable, and production-oriented.

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

Opayque provides a Shielded Vault model:

Merchants operate a private control surface (vault, registry, terminals, API keys).
Customers pay through a shielded checkout path (TEE-assisted transfer construction).
Settlement lands to merchant-controlled wallets; operational state is not broadcast as a live public P&L.

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
| Hardware Fleet | Paired POS terminals with codes, unpair, refresh |
| Terminal | Cashier UI → generates pay links / QR → customer checkout |
| Shielded Checkout | Customer-facing payment surface (amount, wallet, TEE path) |
| Developer Hub | API keys, overview, RPC/terminal telemetry, embed links |
| Merchant session | Bound merchantId + settlement wallet after login |

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
Terminal fleet pairing / unpair / refresh codes  

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
Optional dedicated Helius / other RPC:
NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

MagicBlock / payments (if used in your deployment)
NEXT_PUBLIC_MAGICBLOCK_API=https://payments.magicblock.app
MAGICBLOCK_API_KEY=your_server_only_magicblock_key

Use a reliable RPC in production. Public free endpoints will rate-limit real checkout flows.

Run

npm run dev
open http://localhost:3000

Build

npm run build
npm start

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
Merchant sees activity (local feed and/or backend trail)  

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

Never** commit service-role keys or production secrets.  
Prefer email+password auth with confirmations disabled only if intentional; do not disable the email provider itself.  
Merchant session binding (merchantId) is required for terminal and many API routes—login must hydrate /api/v1/merchant.  
Checkout should timeout failed TEE/RPC builds rather than spin forever.  
Treat confidential / TEE paths as environment-sensitive: wrong RPC, mint, or incomplete confidential setup will fail transfer construction.  
RLS on Supabase tables should scope merchants to their own rows.  

Deployment

Vercel
Import the GitHub repo  
Set the same env vars as local (production values)  
Deploy production  
Point NEXT_PUBLIC_APP_URL at the production domain  

Post-deploy checks
[ ] Login binds merchant session  
[ ] Registry loads without infinite “verifying”  
[ ] Terminal pairing updates fleet  
[ ] Checkout does not hang on SHIELDING (error or success within timeout)  
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