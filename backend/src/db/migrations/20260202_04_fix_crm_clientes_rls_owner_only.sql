BEGIN;

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);

  EXECUTE format('DROP POLICY IF EXISTS rbac_clientes_select ON %s', tbl);
  EXECUTE format('DROP POLICY IF EXISTS rbac_clientes_insert ON %s', tbl);
  EXECUTE format('DROP POLICY IF EXISTS rbac_clientes_update ON %s', tbl);

  EXECUTE format(
    $p$
    CREATE POLICY rbac_clientes_select
    ON %1$s FOR SELECT TO authenticated
    USING (
      deleted_at IS NULL
      AND (
        user_id = auth.uid()
        OR public.is_admin()
      )
    )
    $p$,
    tbl
  );

  EXECUTE format(
    $p$
    CREATE POLICY rbac_clientes_insert
    ON %1$s FOR INSERT TO authenticated
    WITH CHECK (
      deleted_at IS NULL
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (
        public.is_admin()
        OR user_id = auth.uid()
        OR user_id IS NULL
      )
    )
    $p$,
    tbl
  );

  EXECUTE format(
    $p$
    CREATE POLICY rbac_clientes_update
    ON %1$s FOR UPDATE TO authenticated
    USING (
      deleted_at IS NULL
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (
        user_id = auth.uid()
        OR public.is_admin()
      )
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (
        public.is_admin()
        OR public.is_crm_cliente_owner(cliente_id)
      )
      AND (
        deleted_at IS NULL
        OR public.is_admin()
      )
    )
    $p$,
    tbl
  );
END;
$$;

COMMIT;

