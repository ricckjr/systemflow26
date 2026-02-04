BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'crm_produtos_cod_seq_simple'
  ) THEN
    CREATE SEQUENCE public.crm_produtos_cod_seq_simple START 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_produtos_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  IF NEW.codigo_prod IS NULL OR btrim(NEW.codigo_prod) = '' THEN
    n := nextval('public.crm_produtos_cod_seq_simple');
    NEW.codigo_prod := 'PRD' || lpad(n::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  max_n bigint;
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  WITH ordered AS (
    SELECT
      prod_id,
      row_number() OVER (ORDER BY criado_em NULLS LAST, prod_id) AS rn
    FROM public.crm_produtos
    WHERE codigo_prod IS NULL
      OR btrim(codigo_prod) = ''
      OR upper(codigo_prod) LIKE 'PRD%'
  )
  UPDATE public.crm_produtos p
     SET codigo_prod = 'PRD' || lpad(ordered.rn::text, 2, '0')
    FROM ordered
   WHERE p.prod_id = ordered.prod_id;

  SELECT COALESCE(
    MAX((regexp_replace(codigo_prod, '^PRD', ''))::bigint),
    0
  )
  INTO max_n
  FROM public.crm_produtos
  WHERE codigo_prod ~ '^PRD[0-9]+$';

  PERFORM setval('public.crm_produtos_cod_seq_simple', max_n, true);
END $$;

COMMIT;

