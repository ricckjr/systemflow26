BEGIN;

DO $$
DECLARE
  clientes_tbl regclass := to_regclass('public.crm_clientes');
  contatos_tbl regclass := to_regclass('public.crm_contatos');
  origem_tbl regclass := to_regclass('public.crm_origem_leads');
  has_perm boolean := to_regprocedure('public.has_permission(uuid,text,text)') IS NOT NULL;
  clientes_has_deleted boolean := false;
  contatos_has_deleted boolean := false;
BEGIN
  IF clientes_tbl IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'crm_clientes'
        AND column_name = 'deleted_at'
    ) INTO clientes_has_deleted;

    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', clientes_tbl);
    EXECUTE format('DROP POLICY IF EXISTS rbac_clientes_select ON %s', clientes_tbl);
    EXECUTE format('DROP POLICY IF EXISTS crm_clientes_select_auth ON %s', clientes_tbl);

    IF has_perm THEN
      IF clientes_has_deleted THEN
        EXECUTE format(
          $p$
          CREATE POLICY rbac_clientes_select
          ON %1$s FOR SELECT TO authenticated
          USING (deleted_at IS NULL AND public.has_permission(auth.uid(), 'CRM', 'VIEW'))
          $p$,
          clientes_tbl
        );
      ELSE
        EXECUTE format(
          $p$
          CREATE POLICY rbac_clientes_select
          ON %1$s FOR SELECT TO authenticated
          USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
          $p$,
          clientes_tbl
        );
      END IF;
    ELSE
      IF clientes_has_deleted THEN
        EXECUTE format(
          $p$
          CREATE POLICY rbac_clientes_select
          ON %1$s FOR SELECT TO authenticated
          USING (deleted_at IS NULL)
          $p$,
          clientes_tbl
        );
      ELSE
        EXECUTE format(
          $p$
          CREATE POLICY rbac_clientes_select
          ON %1$s FOR SELECT TO authenticated
          USING (true)
          $p$,
          clientes_tbl
        );
      END IF;
    END IF;
  END IF;

  IF contatos_tbl IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'crm_contatos'
        AND column_name = 'deleted_at'
    ) INTO contatos_has_deleted;

    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', contatos_tbl);
    EXECUTE format('DROP POLICY IF EXISTS clientes_contatos_select_own ON %s', contatos_tbl);
    EXECUTE format('DROP POLICY IF EXISTS rbac_crm_contatos_select ON %s', contatos_tbl);
    EXECUTE format('DROP POLICY IF EXISTS crm_contatos_select_auth ON %s', contatos_tbl);

    IF has_perm THEN
      IF contatos_has_deleted THEN
        EXECUTE format(
          $p$
          CREATE POLICY rbac_crm_contatos_select
          ON %1$s FOR SELECT TO authenticated
          USING (deleted_at IS NULL AND public.has_permission(auth.uid(), 'CRM', 'VIEW'))
          $p$,
          contatos_tbl
        );
      ELSE
        EXECUTE format(
          $p$
          CREATE POLICY rbac_crm_contatos_select
          ON %1$s FOR SELECT TO authenticated
          USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
          $p$,
          contatos_tbl
        );
      END IF;
    ELSE
      IF contatos_has_deleted THEN
        EXECUTE format(
          $p$
          CREATE POLICY rbac_crm_contatos_select
          ON %1$s FOR SELECT TO authenticated
          USING (deleted_at IS NULL)
          $p$,
          contatos_tbl
        );
      ELSE
        EXECUTE format(
          $p$
          CREATE POLICY rbac_crm_contatos_select
          ON %1$s FOR SELECT TO authenticated
          USING (true)
          $p$,
          contatos_tbl
        );
      END IF;
    END IF;
  END IF;

  IF origem_tbl IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', origem_tbl);
    EXECUTE format('DROP POLICY IF EXISTS crm_origem_leads_select_auth ON %s', origem_tbl);
    EXECUTE format('DROP POLICY IF EXISTS rbac_crm_origem_leads_select ON %s', origem_tbl);

    IF has_perm THEN
      EXECUTE format(
        $p$
        CREATE POLICY rbac_crm_origem_leads_select
        ON %1$s FOR SELECT TO authenticated
        USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
        $p$,
        origem_tbl
      );
    ELSE
      EXECUTE format(
        $p$
        CREATE POLICY rbac_crm_origem_leads_select
        ON %1$s FOR SELECT TO authenticated
        USING (true)
        $p$,
        origem_tbl
      );
    END IF;
  END IF;
END $$;

COMMIT;
