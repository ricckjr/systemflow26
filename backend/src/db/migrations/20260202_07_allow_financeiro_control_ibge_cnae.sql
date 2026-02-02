BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_ibge_codigos') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_ibge_codigos_all_control ON public.crm_ibge_codigos;
    CREATE POLICY crm_ibge_codigos_all_control
      ON public.crm_ibge_codigos
      FOR ALL TO authenticated
      USING (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      )
      WITH CHECK (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      );
  END IF;

  IF to_regclass('public.crm_cnae_codigos') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_cnae_codigos_all_control ON public.crm_cnae_codigos;
    CREATE POLICY crm_cnae_codigos_all_control
      ON public.crm_cnae_codigos
      FOR ALL TO authenticated
      USING (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      )
      WITH CHECK (
        public.is_admin()
        OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
        OR public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      );
  END IF;
END $$;

COMMIT;

