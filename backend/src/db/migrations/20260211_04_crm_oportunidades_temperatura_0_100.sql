BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_temperatura_1_100;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_temperatura_0_100;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT chk_crm_oportunidades_temperatura_0_100 CHECK (
      temperatura IS NULL OR (temperatura >= 0 AND temperatura <= 100)
    );
END $$;

COMMIT;
