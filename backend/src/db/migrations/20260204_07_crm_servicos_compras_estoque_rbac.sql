DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_select ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_insert ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_update ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_delete ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_service_role_all ON public.crm_servicos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_select
      ON public.crm_servicos FOR SELECT TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'VIEW')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'VIEW')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_insert
      ON public.crm_servicos FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_update
      ON public.crm_servicos FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_delete
      ON public.crm_servicos FOR DELETE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_service_role_all
      ON public.crm_servicos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

