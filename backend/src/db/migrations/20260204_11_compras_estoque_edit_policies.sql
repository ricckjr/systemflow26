DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_insert ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_update ON public.crm_servicos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_insert
      ON public.crm_servicos FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_update
      ON public.crm_servicos FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      )
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_insert ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_update ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_delete ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_insert
      ON public.crm_produtos FOR INSERT TO authenticated
      WITH CHECK (
        (
          public.has_permission(auth.uid(), 'CRM', 'EDIT')
          OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
        )
        AND created_by = auth.uid()
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_update
      ON public.crm_produtos FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_delete
      ON public.crm_produtos FOR DELETE TO authenticated
      USING (
        (
          public.has_permission(auth.uid(), 'CRM', 'EDIT')
          OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
        )
        AND (
          public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
          OR created_by = auth.uid()
        )
      )
    $p$;
  END IF;
END;
$$;

