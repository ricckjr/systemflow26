BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_etapa') IS NULL THEN
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_etapa_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.etapa_desc := trim(coalesce(NEW.etapa_desc, ''));
  IF NEW.etapa_cor IS NOT NULL THEN
    NEW.etapa_cor := lower(trim(NEW.etapa_cor));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_etapa_assign_ordem()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_ordem integer;
BEGIN
  IF NEW.etapa_ordem IS NULL OR NEW.etapa_ordem <= 0 THEN
    SELECT coalesce(max(etapa_ordem), 0) + 1
      INTO next_ordem
      FROM public.crm_etapa;
    NEW.etapa_ordem := next_ordem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_etapa_normalize ON public.crm_etapa;
CREATE TRIGGER trg_crm_etapa_normalize
BEFORE INSERT OR UPDATE ON public.crm_etapa
FOR EACH ROW
EXECUTE FUNCTION public.crm_etapa_normalize();

DROP TRIGGER IF EXISTS trg_crm_etapa_assign_ordem ON public.crm_etapa;
CREATE TRIGGER trg_crm_etapa_assign_ordem
BEFORE INSERT ON public.crm_etapa
FOR EACH ROW
EXECUTE FUNCTION public.crm_etapa_assign_ordem();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_crm_etapa_desc') THEN
    EXECUTE 'DROP INDEX public.uq_crm_etapa_desc';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_etapa_desc_ci ON public.crm_etapa (lower(etapa_desc));
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_etapa_ordem ON public.crm_etapa (etapa_ordem);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_etapa_cor ON public.crm_etapa (etapa_cor) WHERE etapa_cor IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_crm_etapa_desc_not_empty'
  ) THEN
    ALTER TABLE public.crm_etapa
      ADD CONSTRAINT chk_crm_etapa_desc_not_empty CHECK (length(trim(etapa_desc)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_crm_etapa_cor_hex'
  ) THEN
    ALTER TABLE public.crm_etapa
      ADD CONSTRAINT chk_crm_etapa_cor_hex CHECK (etapa_cor IS NULL OR etapa_cor ~ '^#[0-9a-f]{6}$');
  END IF;
END $$;

UPDATE public.crm_etapa
SET
  etapa_desc = trim(etapa_desc),
  etapa_cor = CASE WHEN etapa_cor IS NULL THEN NULL ELSE lower(trim(etapa_cor)) END
WHERE true;

COMMIT;

