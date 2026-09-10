-- Keep one explicit authenticated owner policy per application table.
-- Earlier hardening added generic policies before the application schema added
-- the canonical *_owner_all policies, leaving redundant permissive policies.
DO $$
DECLARE
  target record;
  policy_row record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('transactions'::text, 'Authenticated owners can manage transactions'::text),
      ('bank_accounts'::text, 'bank_accounts_owner_all'::text),
      ('settlements'::text, 'settlements_owner_all'::text),
      ('webhook_configs'::text, 'webhook_configs_owner_all'::text),
      ('checkout_sessions'::text, 'checkout_sessions_owner_all'::text),
      ('developer_projects'::text, 'Authenticated owners can manage developer_projects'::text),
      ('onchain_transactions'::text, 'onchain_transactions_owner_all'::text)
    ) AS policies(table_name, keep_policy)
  LOOP
    IF to_regclass(format('public.%I', target.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR policy_row IN
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class rel ON rel.oid = pol.polrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = rel.relnamespace
      WHERE namespace_row.nspname = 'public'
        AND rel.relname = target.table_name
        AND pol.polname <> target.keep_policy
        AND pol.polroles @> ARRAY['authenticated'::regrole::oid]
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_row.polname, target.table_name);
    END LOOP;
  END LOOP;
END $$;