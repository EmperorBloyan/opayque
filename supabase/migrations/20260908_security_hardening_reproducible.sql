-- Reconcile security hardening performed in the production database.
-- Every operation is conditional so this can also be applied to a fresh database.

DROP TABLE IF EXISTS public.pairing_codes CASCADE;

DO $$
BEGIN
  IF to_regclass('public.terminal_pairing_codes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.terminal_pairing_codes'::regclass
         AND conname = 'unique_pairing_code'
     ) THEN
    ALTER TABLE public.terminal_pairing_codes
      DROP CONSTRAINT unique_pairing_code;
  END IF;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'terminal_pairing_codes', 'transactions', 'bank_accounts',
    'settlements', 'webhook_configs', 'webhook_logs',
    'developer_projects', 'checkout_sessions', 'onchain_transactions'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;
  END LOOP;
END $$;

-- Recreate the authenticated owner boundary for the hardened tables. Existing
-- policies are replaced because their names and original roles varied by deploy.
DO $$
DECLARE
  table_name text;
  policy_name text;
  owner_expression text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'terminal_pairing_codes', 'transactions', 'bank_accounts',
    'settlements', 'webhook_configs', 'webhook_logs',
    'developer_projects', 'checkout_sessions', 'onchain_transactions'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR policy_name IN
      SELECT pol.polname
      FROM pg_policy pol
      WHERE pol.polrelid = format('public.%I', table_name)::regclass
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;

    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = format('public.%I', table_name)::regclass
        AND attname = 'merchant_id' AND NOT attisdropped
    ) THEN
      owner_expression := format(
        'EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id::text AND m.auth_user_id = (select auth.uid()))'
      );
    ELSIF table_name = 'developer_projects' THEN
      owner_expression := 'user_id = (select auth.uid())';
    ELSIF table_name = 'webhook_logs' THEN
      owner_expression := 'EXISTS (SELECT 1 FROM public.developer_projects p WHERE p.id = project_id AND p.user_id = (select auth.uid()))';
    ELSE
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'Authenticated owners can manage ' || table_name,
      table_name,
      owner_expression,
      owner_expression
    );
  END LOOP;
END $$;

-- Evaluate auth.uid() once per statement instead of once per row in RLS scans.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
  LOOP
    IF policy_row.qual IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_row.policyname, policy_row.schemaname, policy_row.tablename,
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())')
      );
    END IF;
    IF policy_row.with_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_row.policyname, policy_row.schemaname, policy_row.tablename,
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())')
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  function_row record;
BEGIN
  FOR function_row IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('sync_merchants_wallet_address', 'set_payment_ledger_updated_at')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      function_row.schema_name, function_row.function_name, function_row.arguments
    );
  END LOOP;
END $$;

-- Index every foreign key that is not already covered by an index prefix.
DO $$
DECLARE
  foreign_key record;
  index_name text;
  column_list text;
BEGIN
  FOR foreign_key IN
    SELECT c.conrelid,
           c.conname,
           c.conkey,
           array_agg(a.attname ORDER BY key.position) AS column_names
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key(attnum, position)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    GROUP BY c.oid, c.conrelid, c.conname, c.conkey
    HAVING NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND i.indisvalid
        AND (i.indkey::smallint[])[1:cardinality(c.conkey)] = c.conkey
    )
  LOOP
    column_list := array_to_string(
      ARRAY(SELECT format('%I', column_name)
            FROM unnest(foreign_key.column_names) AS column_name), ', '
    );
    index_name := left(
      format('idx_fk_%s_%s', foreign_key.conrelid::regclass, md5(foreign_key.conname)),
      63
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
      index_name, foreign_key.conrelid::regclass, column_list
    );
  END LOOP;
END $$;