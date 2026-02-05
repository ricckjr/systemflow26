BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS desconto_percent_proposta numeric;

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN desconto_percent_proposta SET DEFAULT 0;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_desconto_percent_proposta;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT chk_crm_oportunidades_desconto_percent_proposta
    CHECK (desconto_percent_proposta IS NULL OR (desconto_percent_proposta >= 0 AND desconto_percent_proposta <= 100));
END $$;

COMMIT;
