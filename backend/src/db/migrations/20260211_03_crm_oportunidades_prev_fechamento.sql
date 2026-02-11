BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS prev_fechamento date;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_prev_fechamento
  ON public.crm_oportunidades (prev_fechamento);

COMMIT;
