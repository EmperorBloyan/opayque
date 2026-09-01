# Security

Report suspected vulnerabilities privately to the repository owner before opening a public issue. Include the affected route or file, reproduction steps, impact, and a minimal proof of concept. Do not include real API keys, wallet private keys, service-role credentials, customer data, or transaction secrets in reports.

For urgent production incidents, rotate the affected credential immediately, disable the related Vercel environment variable or endpoint, and preserve sanitized logs and transaction signatures for investigation. Secret rotation must include revoking the old API key or relayer key, creating a replacement, updating only the intended Preview or Production environment, redeploying, and verifying the old credential is rejected.

Opayque is non-custodial. Never submit wallet private keys, `RELAYER_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, MagicBlock keys, Upstash tokens, off-ramp keys, or Sentry auth tokens to the browser or an issue tracker.
