BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'ncm_codigo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'ncm_id'
  ) THEN
    ALTER TABLE public.crm_produtos RENAME COLUMN ncm_codigo TO ncm_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'crm_produtos' AND column_name = 'ncm_id'
  ) THEN
    ALTER TABLE public.crm_produtos ADD COLUMN ncm_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_produtos
     SET ncm_id = NULLIF(regexp_replace(ncm_id, '\D', '', 'g'), '')
   WHERE ncm_id IS NOT NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL OR to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    DROP CONSTRAINT IF EXISTS crm_produtos_ncm_codigo_fkey;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_produtos_ncm_id_fkey') THEN
    ALTER TABLE public.crm_produtos
      ADD CONSTRAINT crm_produtos_ncm_id_fkey FOREIGN KEY (ncm_id) REFERENCES public.ncm(ncm_id) ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_produtos_ncm_id ON public.crm_produtos(ncm_id);

COMMIT;

