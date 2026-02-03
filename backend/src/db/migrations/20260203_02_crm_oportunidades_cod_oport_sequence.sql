BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.crm_oportunidades_cod_oport_seq') IS NULL THEN
    CREATE SEQUENCE public.crm_oportunidades_cod_oport_seq
      START WITH 1000
      INCREMENT BY 1
      MINVALUE 1000;
  END IF;
END $$;

DO $$
DECLARE
  max_code BIGINT;
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL OR to_regclass('public.crm_oportunidades_cod_oport_seq') IS NULL THEN
    RETURN;
  END IF;

  SELECT max(cod_oport::bigint)
  INTO max_code
  FROM public.crm_oportunidades
  WHERE cod_oport ~ '^[0-9]+$';

  IF max_code IS NULL OR max_code < 1000 THEN
    PERFORM setval('public.crm_oportunidades_cod_oport_seq', 1000, false);
  ELSE
    PERFORM setval('public.crm_oportunidades_cod_oport_seq', max_code, true);
  END IF;

  UPDATE public.crm_oportunidades
    SET cod_oport = nextval('public.crm_oportunidades_cod_oport_seq')::text
    WHERE cod_oport IS NULL OR btrim(cod_oport) = '';
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_assign_cod_oport()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cod_oport IS NULL OR btrim(NEW.cod_oport) = '' THEN
    NEW.cod_oport := nextval('public.crm_oportunidades_cod_oport_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_assign_cod_oport ON public.crm_oportunidades;

  CREATE TRIGGER trg_crm_oportunidades_assign_cod_oport
  BEFORE INSERT ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_assign_cod_oport();
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
