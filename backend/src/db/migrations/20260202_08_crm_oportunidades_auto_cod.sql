BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'S'
       AND n.nspname = 'public'
       AND c.relname = 'crm_oportunidades_cod_seq'
  ) THEN
    CREATE SEQUENCE public.crm_oportunidades_cod_seq START 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_assign_cod()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  y text;
  n bigint;
BEGIN
  IF NEW.cod_oport IS NULL OR btrim(NEW.cod_oport) = '' THEN
    y := to_char(coalesce(NEW.data_inclusao, now()), 'YYYY');
    n := nextval('public.crm_oportunidades_cod_seq');
    NEW.cod_oport := 'PC-' || y || '-' || lpad(n::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidades_assign_cod'
  ) THEN
    CREATE TRIGGER trg_crm_oportunidades_assign_cod
    BEFORE INSERT ON public.crm_oportunidades
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_oportunidades_assign_cod();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_oportunidades
     SET cod_oport = 'PC-' || to_char(coalesce(data_inclusao, now()), 'YYYY') || '-' || lpad(nextval('public.crm_oportunidades_cod_seq')::text, 6, '0')
   WHERE cod_oport IS NULL OR btrim(cod_oport) = '';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_oportunidades_cod_oport
           ON public.crm_oportunidades (cod_oport)
           WHERE cod_oport IS NOT NULL AND btrim(cod_oport) <> ''''';
END $$;

COMMIT;
