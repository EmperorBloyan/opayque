# Opayque Privacy Threat Model

Opayque provides merchant operational privacy only within the guarantees of the configured MagicBlock provider and the underlying Solana transaction path. It does not provide universal anonymity.

## Public blockchain observer

A public observer can see any public Solana transaction, including public sender/recipient accounts, token mint, transferred amount, slot, fees, and timing. They can correlate public signatures and addresses. A private MagicBlock path may reduce what is visible on the public chain, but this is provider-dependent and must not be inferred from a client-side label alone.

## RPC provider

The selected RPC provider can observe requests, queried signatures, wallet addresses, transaction timing, and network metadata. It may correlate requests with the application or customer network address depending on deployment and provider logs.

## Privacy provider

MagicBlock receives the private transfer request, sender/recipient, mint, amount, memo, cluster, and timing needed to construct the transaction. The provider is therefore a trust assumption. Opayque does not claim that the provider cannot observe payment metadata.

## Opayque infrastructure

The server can see merchant identity, payment intent metadata, configured recipient, terminal/API origin, request timing, and provider responses. Server logs and database access must be treated as sensitive. Service-role access can bypass RLS and is restricted to server-side code.

## Merchant

The merchant can see its own payment intents, settlement state, webhook events, configured endpoints, terminal activity, and any customer metadata it requested. Merchant isolation must prevent access to another merchant's records.

## Customer

The customer can see the checkout details presented by the merchant, wallet and transaction information available to their wallet/RPC, and any public chain facts. A customer should not receive server credentials, other merchant records, or internal reconciliation/provider diagnostics.

## Compromised terminal

A compromised terminal may expose its terminal credential, current payment inputs, merchant-facing checkout context, and timing. The credential must be revocable and terminal-scoped. It must not grant merchant dashboard access, another terminal's access, or arbitrary settlement destination control.

## Compromised API key

A compromised API key grants only the documented merchant/environment scopes of that key until revoked. It may create or inspect merchant-scoped payment sessions according to the route contract. It must not reveal private keys, service-role credentials, other merchants, or unrestricted administrative operations.

## Timing correlation

Payment creation, provider calls, wallet signing, broadcast, and webhook delivery can be correlated by timing. Private settlement does not eliminate timing metadata. Deployments requiring stronger privacy should consider batching, timing policy, and provider/network metadata controls explicitly.

## Metadata correlation

Merchant/payment relationships can be inferred from checkout URLs, recipient addresses, API traffic, references, webhook destinations, terminal identifiers, and public signatures. Opayque minimizes unnecessary exposure but does not guarantee unlinkability.

## Privacy boundary

The accurate claim is: Opayque can provide confidential amount/recipient handling on a successfully verified provider-supported private path, subject to MagicBlock, RPC, infrastructure, wallet, timing, and metadata trust assumptions. If the private path fails or its privacy mode cannot be verified, the operation fails closed; it is never silently converted to a public transfer.
