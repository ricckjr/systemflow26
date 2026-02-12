BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos_imagens') IS NULL THEN
    RETURN;
  END IF;

  DROP TABLE IF EXISTS public.crm_produtos_imagens CASCADE;
END $$;

COMMIT;

