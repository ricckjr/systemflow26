BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    DROP COLUMN IF EXISTS gtin_ean,
    DROP COLUMN IF EXISTS imagem_path;
END $$;

COMMIT;

