DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_servicos_update ON public.crm_servicos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_update
      ON public.crm_servicos FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
      )
      WITH CHECK (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
      )
    $p$;
  END IF;
END;
$$;
