-- Application tables are accessed through authenticated sessions or server-side
-- service-role routes. Anonymous clients must not receive table privileges.
REVOKE ALL ON TABLE
  public.terminal_pairing_codes,
  public.transactions,
  public.bank_accounts,
  public.settlements,
  public.webhook_configs,
  public.webhook_logs,
  public.developer_projects,
  public.checkout_sessions,
  public.onchain_transactions,
  public.payment_ledger
FROM anon;