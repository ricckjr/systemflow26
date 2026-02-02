BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_status') IS NULL THEN
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_status_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status_desc := trim(coalesce(NEW.status_desc, ''));
  IF NEW.status_cor IS NOT NULL THEN
    NEW.status_cor := lower(trim(NEW.status_cor));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_status_assign_ordem()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_ordem integer;
BEGIN
  IF NEW.status_ordem IS NULL OR NEW.status_ordem <= 0 THEN
    SELECT coalesce(max(status_ordem), 0) + 1
      INTO next_ordem
      FROM public.crm_status;
    NEW.status_ordem := next_ordem;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_status_normalize ON public.crm_status;
CREATE TRIGGER trg_crm_status_normalize
BEFORE INSERT OR UPDATE ON public.crm_status
FOR EACH ROW
EXECUTE FUNCTION public.crm_status_normalize();

DROP TRIGGER IF EXISTS trg_crm_status_assign_ordem ON public.crm_status;
CREATE TRIGGER trg_crm_status_assign_ordem
BEFORE INSERT ON public.crm_status
FOR EACH ROW
EXECUTE FUNCTION public.crm_status_assign_ordem();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_crm_status_desc') THEN
    EXECUTE 'DROP INDEX public.uq_crm_status_desc';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_status_desc_ci ON public.crm_status (lower(status_desc));
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_status_ordem ON public.crm_status (status_ordem);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_status_cor ON public.crm_status (status_cor) WHERE status_cor IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_crm_status_desc_not_empty'
  ) THEN
    ALTER TABLE public.crm_status
      ADD CONSTRAINT chk_crm_status_desc_not_empty CHECK (length(trim(status_desc)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_crm_status_cor_hex'
  ) THEN
    ALTER TABLE public.crm_status
      ADD CONSTRAINT chk_crm_status_cor_hex CHECK (status_cor IS NULL OR status_cor ~ '^#[0-9a-f]{6}$');
  END IF;
END $$;

UPDATE public.crm_status
SET
  status_desc = trim(status_desc),
  status_cor = CASE WHEN status_cor IS NULL THEN NULL ELSE lower(trim(status_cor)) END
WHERE true;

COMMIT;

