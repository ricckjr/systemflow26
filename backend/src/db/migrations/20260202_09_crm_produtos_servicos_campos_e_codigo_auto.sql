BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ADD COLUMN IF NOT EXISTS codigo_prod TEXT,
    ADD COLUMN IF NOT EXISTS situacao_prod BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS marca_prod TEXT,
    ADD COLUMN IF NOT EXISTS modelo_prod TEXT;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_servicos
    ADD COLUMN IF NOT EXISTS codigo_serv TEXT,
    ADD COLUMN IF NOT EXISTS situacao_serv BOOLEAN NOT NULL DEFAULT true;
END $$;

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
       AND c.relname = 'crm_produtos_cod_seq'
  ) THEN
    CREATE SEQUENCE public.crm_produtos_cod_seq START 1;
  END IF;
END $$;

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
       AND c.relname = 'crm_servicos_cod_seq'
  ) THEN
    CREATE SEQUENCE public.crm_servicos_cod_seq START 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_produtos_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  y text;
  n bigint;
BEGIN
  IF NEW.codigo_prod IS NULL OR btrim(NEW.codigo_prod) = '' THEN
    y := to_char(now(), 'YYYY');
    n := nextval('public.crm_produtos_cod_seq');
    NEW.codigo_prod := 'PRD-' || y || '-' || lpad(n::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_servicos_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  y text;
  n bigint;
BEGIN
  IF NEW.codigo_serv IS NULL OR btrim(NEW.codigo_serv) = '' THEN
    y := to_char(now(), 'YYYY');
    n := nextval('public.crm_servicos_cod_seq');
    NEW.codigo_serv := 'SRV-' || y || '-' || lpad(n::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_produtos_assign_codigo'
  ) THEN
    CREATE TRIGGER trg_crm_produtos_assign_codigo
    BEFORE INSERT ON public.crm_produtos
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_produtos_assign_codigo();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_servicos_assign_codigo'
  ) THEN
    CREATE TRIGGER trg_crm_servicos_assign_codigo
    BEFORE INSERT ON public.crm_servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_servicos_assign_codigo();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_produtos
     SET codigo_prod = 'PRD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.crm_produtos_cod_seq')::text, 6, '0')
   WHERE codigo_prod IS NULL OR btrim(codigo_prod) = '';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_servicos
     SET codigo_serv = 'SRV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.crm_servicos_cod_seq')::text, 6, '0')
   WHERE codigo_serv IS NULL OR btrim(codigo_serv) = '';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_produtos_codigo_prod
           ON public.crm_produtos (codigo_prod)
           WHERE codigo_prod IS NOT NULL AND btrim(codigo_prod) <> ''''';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_servicos_codigo_serv
           ON public.crm_servicos (codigo_serv)
           WHERE codigo_serv IS NOT NULL AND btrim(codigo_serv) <> ''''';
END $$;

COMMIT;
