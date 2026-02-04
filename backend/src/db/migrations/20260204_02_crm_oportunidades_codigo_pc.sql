BEGIN;

DO $$
DECLARE
  max_num integer;
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  CREATE SEQUENCE IF NOT EXISTS public.crm_oportunidades_cod_seq
    AS bigint
    START WITH 1000
    INCREMENT BY 1
    MINVALUE 1000;

  ALTER SEQUENCE public.crm_oportunidades_cod_seq INCREMENT BY 1;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq START WITH 1000;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq RESTART WITH 1000;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq MINVALUE 1000;

  SELECT max(NULLIF(regexp_replace(cod_oport, '\D', '', 'g'), '')::int)
    INTO max_num
    FROM public.crm_oportunidades
    WHERE cod_oport ~ '^PC[0-9]+$';

  PERFORM setval('public.crm_oportunidades_cod_seq', GREATEST(COALESCE(max_num, 999), 999), true);
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_assign_cod()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cod_oport IS NULL OR btrim(NEW.cod_oport) = '' THEN
    NEW.cod_oport := 'PC' || lpad(nextval('public.crm_oportunidades_cod_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_lock_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cod_oport IS DISTINCT FROM OLD.cod_oport THEN
    NEW.cod_oport := OLD.cod_oport;
  END IF;
  IF NEW.id_cliente IS DISTINCT FROM OLD.id_cliente THEN
    NEW.id_cliente := OLD.id_cliente;
  END IF;
  IF NEW.id_vendedor IS DISTINCT FROM OLD.id_vendedor THEN
    NEW.id_vendedor := OLD.id_vendedor;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_generate_cod_oport ON public.crm_oportunidades;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidades_lock_immutable_fields'
  ) THEN
    CREATE TRIGGER trg_crm_oportunidades_lock_immutable_fields
    BEFORE UPDATE ON public.crm_oportunidades
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_oportunidades_lock_immutable_fields();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_oportunidades
     SET cod_oport = 'PC' || lpad(nextval('public.crm_oportunidades_cod_seq')::text, 4, '0')
   WHERE cod_oport IS NULL OR btrim(cod_oport) = '' OR cod_oport ~ '^PC-\d{4}-\d{6}$';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_oportunidades_cod_oport
  ON public.crm_oportunidades (cod_oport)
  WHERE cod_oport IS NOT NULL;

COMMIT;
