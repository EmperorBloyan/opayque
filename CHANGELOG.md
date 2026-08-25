# Changelog

- **1, 10:** Payment now performs merchant and treasury SPL transfers before updating accounting counters; fees use configured `fee_bps`, capped at 1000 bps during vault initialization.
- **2:** Withdrawal no longer accepts a meaningless approval boolean; the program interface now requires authority-signed SPL destination accounts.
- **3, 5:** Relayer initialization is session-bound and rate-limited by both IP and authenticated user. Upstash limits are documented.
- **6:** Pairing-code RLS was added and the legacy raw merchant API-key column is removed by migration.
- **7:** Private transfer construction remains MagicBlock-only with no public fallback; failures surface to the caller.
- **8:** Both Anchor hooks now use the shared checked-in IDL and Anchor 0.30 constructor.
- **9:** Terminal and memo limits are enforced and `TerminalNonce::LEN` reserves their complete serialized space.
- **11, 12:** Existing status verification and RPC helpers remain in place; a typed bounded send helper was added for migration of remaining checkout callers.

Anchor build and IDL regeneration are blocked in this environment because `cargo`, `rustc`, and the Anchor CLI are not installed. The checked-in IDL was aligned manually with the changed instruction accounts and arguments; regenerate it with `anchor build` before deployment.