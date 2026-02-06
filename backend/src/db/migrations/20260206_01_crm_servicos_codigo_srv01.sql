BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'crm_servicos_cod_seq_simple'
  ) THEN
    CREATE SEQUENCE public.crm_servicos_cod_seq_simple START 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_servicos_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.codigo_serv IS NULL OR btrim(NEW.codigo_serv) = '' THEN
    n := nextval('public.crm_servicos_cod_seq_simple');
    NEW.codigo_serv := 'SRV' || lpad(n::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  max_n bigint;
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT
      serv_id,
      row_number() OVER (ORDER BY criado_em NULLS LAST, serv_id) AS rn
    FROM public.crm_servicos
    WHERE codigo_serv IS NULL
      OR btrim(codigo_serv) = ''
      OR upper(codigo_serv) LIKE 'SRV%'
  )
  UPDATE public.crm_servicos s
     SET codigo_serv = 'SRV' || lpad(ordered.rn::text, 2, '0')
    FROM ordered
   WHERE s.serv_id = ordered.serv_id;

  SELECT COALESCE(
    MAX((regexp_replace(codigo_serv, '^SRV', ''))::bigint),
    0
  )
  INTO max_n
  FROM public.crm_servicos
  WHERE codigo_serv ~ '^SRV[0-9]+$';

  IF max_n < 1 THEN
    PERFORM setval('public.crm_servicos_cod_seq_simple', 1, false);
  ELSE
    PERFORM setval('public.crm_servicos_cod_seq_simple', max_n, true);
  END IF;
END $$;

COMMIT;
