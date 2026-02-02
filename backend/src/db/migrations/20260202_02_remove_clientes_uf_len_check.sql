BEGIN;

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS clientes_uf_len_check', tbl);
END;
$$;

COMMIT;

