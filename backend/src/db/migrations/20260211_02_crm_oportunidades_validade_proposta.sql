BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS validade_proposta date;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_validade_proposta
  ON public.crm_oportunidades (validade_proposta);

COMMIT;
