BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_solucao;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT chk_crm_oportunidades_solucao CHECK (
      solucao IS NULL OR solucao IN ('PRODUTO','SERVICO')
    ) NOT VALID;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_oportunidades'
      AND policyname = 'rbac_crm_oportunidades_insert'
  ) THEN
    EXECUTE $p$
      ALTER POLICY rbac_crm_oportunidades_insert
      ON public.crm_oportunidades
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (solucao IS NULL OR solucao IN ('PRODUTO','SERVICO'))
      )
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_oportunidades'
      AND policyname = 'rbac_crm_oportunidades_update'
  ) THEN
    EXECUTE $p$
      ALTER POLICY rbac_crm_oportunidades_update
      ON public.crm_oportunidades
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'))
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (solucao IS NULL OR solucao IN ('PRODUTO','SERVICO'))
      )
    $p$;
  END IF;
END $$;

COMMIT;
