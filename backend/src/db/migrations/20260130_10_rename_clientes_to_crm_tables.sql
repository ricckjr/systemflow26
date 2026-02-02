BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_clientes') IS NULL
     AND to_regclass('public.clientes') IS NOT NULL THEN
    ALTER TABLE public.clientes RENAME TO crm_clientes;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_contatos') IS NULL
     AND to_regclass('public.clientes_contatos') IS NOT NULL THEN
    ALTER TABLE public.clientes_contatos RENAME TO crm_contatos;
  END IF;
END $$;

COMMIT;
