BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos ADD COLUMN IF NOT EXISTS cod_proposta_ref TEXT;
END $$;

COMMIT;
