BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ADD COLUMN IF NOT EXISTS unidade_prod TEXT,
    ADD COLUMN IF NOT EXISTS ncm_codigo TEXT,
    ADD COLUMN IF NOT EXISTS local_estoque TEXT NOT NULL DEFAULT 'PADRAO';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_produtos_local_estoque_check'
  ) THEN
    ALTER TABLE public.crm_produtos
      ADD CONSTRAINT crm_produtos_local_estoque_check CHECK (local_estoque IN ('PADRAO', 'INTERNO'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL OR to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_produtos_ncm_codigo_fkey'
  ) THEN
    ALTER TABLE public.crm_produtos
      ADD CONSTRAINT crm_produtos_ncm_codigo_fkey FOREIGN KEY (ncm_codigo) REFERENCES public.ncm(codigo) ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_produtos_unidade_prod ON public.crm_produtos(unidade_prod);
CREATE INDEX IF NOT EXISTS idx_crm_produtos_ncm_codigo ON public.crm_produtos(ncm_codigo);
CREATE INDEX IF NOT EXISTS idx_crm_produtos_local_estoque ON public.crm_produtos(local_estoque);

COMMIT;
