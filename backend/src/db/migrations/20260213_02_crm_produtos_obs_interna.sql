BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'obs_prod'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'obs_interna'
  ) THEN
    ALTER TABLE public.crm_produtos RENAME COLUMN obs_prod TO obs_interna;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'obs_interna'
  ) THEN
    ALTER TABLE public.crm_produtos ADD COLUMN obs_interna TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'descricao_detalhada'
  ) THEN
    ALTER TABLE public.crm_produtos ADD COLUMN descricao_detalhada TEXT;
  END IF;
END $$;

COMMIT;

