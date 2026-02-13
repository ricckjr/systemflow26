BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.crm_servicos_cod_seq_srv000
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

DO $$
DECLARE
  max_n BIGINT;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(substring(codigo_serv from '([0-9]+)$'), '')::BIGINT
    ),
    0
  )
  INTO max_n
  FROM public.crm_servicos
  WHERE codigo_serv IS NOT NULL
    AND btrim(codigo_serv) <> '';

  IF max_n <= 0 THEN
    PERFORM setval('public.crm_servicos_cod_seq_srv000', 1, false);
  ELSE
    PERFORM setval('public.crm_servicos_cod_seq_srv000', max_n, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_servicos_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo_serv IS NULL OR btrim(NEW.codigo_serv) = '' THEN
    NEW.codigo_serv := 'SRV' || lpad(nextval('public.crm_servicos_cod_seq_srv000')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
