DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_update ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_update
      ON public.crm_produtos FOR UPDATE TO authenticated
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
