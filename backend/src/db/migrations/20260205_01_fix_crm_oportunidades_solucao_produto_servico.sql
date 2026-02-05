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
      solucao IS NULL OR solucao IN ('PRODUTO','SERVICO','PRODUTO_SERVICO')
    );
END $$;

COMMIT;
