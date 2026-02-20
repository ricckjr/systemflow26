BEGIN;

DROP FUNCTION IF EXISTS public.is_admin();

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    tbl := NULL;
  END IF;

  IF tbl IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS clientes_select ON %s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS clientes_insert ON %s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS clientes_update ON %s', tbl);

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
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
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
          user_id = auth.uid()
          OR user_id IS NULL
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
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
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND deleted_at IS NULL
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          public.is_crm_cliente_owner(cliente_id)
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
        AND (
          deleted_at IS NULL
          OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
      )
      $p$,
      tbl
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.clientes_contatos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_select ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_insert ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_update ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_clientes_contatos_select ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_clientes_contatos_insert ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_clientes_contatos_update ON public.clientes_contatos';

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_select
      ON public.clientes_contatos FOR SELECT TO authenticated
      USING (
        deleted_at IS NULL
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND (
              c.user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
              OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
            )
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_insert
      ON public.clientes_contatos FOR INSERT TO authenticated
      WITH CHECK (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          user_id = auth.uid()
          OR user_id IS NULL
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND (
              c.user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
              OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
            )
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_update
      ON public.clientes_contatos FOR UPDATE TO authenticated
      USING (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
        AND (
          deleted_at IS NULL
          OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE')
          OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        )
      )
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_update ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_update
      ON public.crm_produtos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_update ON public.crm_servicos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_update
      ON public.crm_servicos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_ibge_codigos') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_ibge_codigos_all_control ON public.crm_ibge_codigos;
    CREATE POLICY crm_ibge_codigos_all_control
      ON public.crm_ibge_codigos
      FOR ALL TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      );
  END IF;

  IF to_regclass('public.crm_cnae_codigos') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_cnae_codigos_all_control ON public.crm_cnae_codigos;
    CREATE POLICY crm_cnae_codigos_all_control
      ON public.crm_cnae_codigos
      FOR ALL TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      );
  END IF;
END $$;

COMMIT;

