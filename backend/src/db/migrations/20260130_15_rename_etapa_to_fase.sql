BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_etapa') IS NOT NULL AND to_regclass('public.crm_fase') IS NULL THEN
    ALTER TABLE public.crm_etapa RENAME TO crm_fase;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_fase' AND column_name = 'etapa_id'
  ) THEN
    ALTER TABLE public.crm_fase RENAME COLUMN etapa_id TO fase_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_fase' AND column_name = 'etapa_desc'
  ) THEN
    ALTER TABLE public.crm_fase RENAME COLUMN etapa_desc TO fase_desc;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_fase' AND column_name = 'etapa_obs'
  ) THEN
    ALTER TABLE public.crm_fase RENAME COLUMN etapa_obs TO fase_obs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_fase' AND column_name = 'etapa_ordem'
  ) THEN
    ALTER TABLE public.crm_fase RENAME COLUMN etapa_ordem TO fase_ordem;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_fase' AND column_name = 'etapa_cor'
  ) THEN
    ALTER TABLE public.crm_fase RENAME COLUMN etapa_cor TO fase_cor;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'etapa'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'fase'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN etapa TO fase;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_fase DROP CONSTRAINT IF EXISTS chk_crm_etapa_desc_not_empty;
  ALTER TABLE public.crm_fase DROP CONSTRAINT IF EXISTS chk_crm_etapa_cor_hex;
  ALTER TABLE public.crm_fase DROP CONSTRAINT IF EXISTS chk_crm_fase_desc_not_empty;
  ALTER TABLE public.crm_fase DROP CONSTRAINT IF EXISTS chk_crm_fase_cor_hex;

  ALTER TABLE public.crm_fase
    ADD CONSTRAINT chk_crm_fase_desc_not_empty CHECK (length(trim(fase_desc)) > 0);

  ALTER TABLE public.crm_fase
    ADD CONSTRAINT chk_crm_fase_cor_hex CHECK (fase_cor IS NULL OR lower(fase_cor) ~ '^#[0-9a-f]{6}$');
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_etapa_normalize ON public.crm_fase;
  DROP TRIGGER IF EXISTS trg_crm_etapa_assign_ordem ON public.crm_fase;
  DROP TRIGGER IF EXISTS trg_crm_fase_normalize ON public.crm_fase;
  DROP TRIGGER IF EXISTS trg_crm_fase_assign_ordem ON public.crm_fase;

  DROP FUNCTION IF EXISTS public.crm_etapa_normalize();
  DROP FUNCTION IF EXISTS public.crm_etapa_assign_ordem();
  DROP FUNCTION IF EXISTS public.crm_fase_normalize();
  DROP FUNCTION IF EXISTS public.crm_fase_assign_ordem();
END $$;

CREATE OR REPLACE FUNCTION public.crm_fase_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fase_desc := trim(coalesce(NEW.fase_desc, ''));
  IF NEW.fase_cor IS NOT NULL THEN
    NEW.fase_cor := lower(trim(NEW.fase_cor));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_fase_assign_ordem()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_ordem integer;
BEGIN
  IF NEW.fase_ordem IS NULL OR NEW.fase_ordem <= 0 THEN
    SELECT coalesce(max(fase_ordem), 0) + 1
      INTO next_ordem
      FROM public.crm_fase;
    NEW.fase_ordem := next_ordem;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  CREATE TRIGGER trg_crm_fase_normalize
  BEFORE INSERT OR UPDATE ON public.crm_fase
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_fase_normalize();

  CREATE TRIGGER trg_crm_fase_assign_ordem
  BEFORE INSERT ON public.crm_fase
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_fase_assign_ordem();
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  DROP INDEX IF EXISTS public.uq_crm_etapa_desc_ci;
  DROP INDEX IF EXISTS public.uq_crm_etapa_ordem;
  DROP INDEX IF EXISTS public.uq_crm_etapa_cor;
  DROP INDEX IF EXISTS public.uq_crm_etapa_desc;
  DROP INDEX IF EXISTS public.idx_crm_etapa_desc;
  DROP INDEX IF EXISTS public.idx_crm_etapa_ordem;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_fase_desc_ci ON public.crm_fase (lower(fase_desc));
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_fase_ordem ON public.crm_fase (fase_ordem);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_fase_cor ON public.crm_fase (fase_cor) WHERE fase_cor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_fase_desc ON public.crm_fase (fase_desc);
CREATE INDEX IF NOT EXISTS idx_crm_fase_ordem ON public.crm_fase (fase_ordem);

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_fase
  SET
    fase_desc = trim(fase_desc),
    fase_cor = CASE WHEN fase_cor IS NULL THEN NULL ELSE lower(trim(fase_cor)) END
  WHERE true;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_fase') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_fase' AND policyname='rbac_crm_etapa_select') THEN
    EXECUTE 'ALTER POLICY rbac_crm_etapa_select ON public.crm_fase RENAME TO rbac_crm_fase_select';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_fase' AND policyname='rbac_crm_etapa_insert') THEN
    EXECUTE 'ALTER POLICY rbac_crm_etapa_insert ON public.crm_fase RENAME TO rbac_crm_fase_insert';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_fase' AND policyname='rbac_crm_etapa_update') THEN
    EXECUTE 'ALTER POLICY rbac_crm_etapa_update ON public.crm_fase RENAME TO rbac_crm_fase_update';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_fase' AND policyname='rbac_crm_etapa_delete') THEN
    EXECUTE 'ALTER POLICY rbac_crm_etapa_delete ON public.crm_fase RENAME TO rbac_crm_fase_delete';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_fase' AND policyname='rbac_crm_etapa_service_role_all') THEN
    EXECUTE 'ALTER POLICY rbac_crm_etapa_service_role_all ON public.crm_fase RENAME TO rbac_crm_fase_service_role_all';
  END IF;
END $$;

COMMIT;

