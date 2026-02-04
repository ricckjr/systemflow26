BEGIN;

DO $$
DECLARE
  max_num bigint;
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  CREATE SEQUENCE IF NOT EXISTS public.crm_oportunidades_cod_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1;

  ALTER SEQUENCE public.crm_oportunidades_cod_seq INCREMENT BY 1;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq MINVALUE 1;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq START WITH 1;
  ALTER SEQUENCE public.crm_oportunidades_cod_seq RESTART WITH 1;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_assign_cod ON public.crm_oportunidades;
  DROP TRIGGER IF EXISTS trg_crm_oportunidades_generate_cod_oport ON public.crm_oportunidades;
  DROP TRIGGER IF EXISTS trg_crm_oportunidades_generate_cod ON public.crm_oportunidades;

  CREATE OR REPLACE FUNCTION public.crm_oportunidades_assign_cod()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $fn$
  BEGIN
    IF NEW.cod_oport IS NULL OR btrim(NEW.cod_oport) = '' THEN
      NEW.cod_oport := 'PC' || lpad(nextval('public.crm_oportunidades_cod_seq')::text, 2, '0');
    END IF;
    RETURN NEW;
  END;
  $fn$;

  CREATE TRIGGER trg_crm_oportunidades_assign_cod
  BEFORE INSERT ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_assign_cod();

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_lock_immutable_fields ON public.crm_oportunidades;

  WITH ranked AS (
    SELECT id_oport, row_number() OVER (ORDER BY data_inclusao, id_oport) AS rn
    FROM public.crm_oportunidades
  )
  UPDATE public.crm_oportunidades o
     SET cod_oport = 'PC' || lpad(ranked.rn::text, 2, '0')
    FROM ranked
   WHERE o.id_oport = ranked.id_oport;

  SELECT max(NULLIF(regexp_replace(cod_oport, '\D', '', 'g'), '')::bigint)
    INTO max_num
    FROM public.crm_oportunidades
   WHERE cod_oport ~ '^PC[0-9]+$';

  IF max_num IS NULL OR max_num < 1 THEN
    PERFORM setval('public.crm_oportunidades_cod_seq', 1, false);
  ELSE
    PERFORM setval('public.crm_oportunidades_cod_seq', max_num, true);
  END IF;

  CREATE OR REPLACE FUNCTION public.crm_oportunidades_lock_immutable_fields()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $lock$
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
  $lock$;

  CREATE TRIGGER trg_crm_oportunidades_lock_immutable_fields
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_lock_immutable_fields();
END $$;

COMMIT;
