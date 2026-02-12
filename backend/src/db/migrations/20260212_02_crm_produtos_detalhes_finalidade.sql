BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT,
    ADD COLUMN IF NOT EXISTS finalidade_item TEXT;
END $$;

COMMIT;

