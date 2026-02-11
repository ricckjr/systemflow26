BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_prev_entrega_month;
END $$;

COMMIT;
