BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS pedido_compra_numero text;
END $$;

COMMIT;
