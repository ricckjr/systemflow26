DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_select ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_insert ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_update ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_delete ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_service_role_all ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_select
      ON public.crm_produtos FOR SELECT TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'VIEW')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'VIEW')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_insert
      ON public.crm_produtos FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_update
      ON public.crm_produtos FOR UPDATE TO authenticated
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
      CREATE POLICY rbac_crm_produtos_delete
      ON public.crm_produtos FOR DELETE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_service_role_all
      ON public.crm_produtos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

