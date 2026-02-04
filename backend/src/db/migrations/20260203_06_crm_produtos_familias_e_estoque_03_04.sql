BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_produtos_familias (
  familia_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_produtos_familias_nome_ci
  ON public.crm_produtos_familias ((lower(nome)));

ALTER TABLE public.crm_produtos_familias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_produtos_familias' AND policyname = 'crm_produtos_familias_select_auth'
  ) THEN
    CREATE POLICY crm_produtos_familias_select_auth ON public.crm_produtos_familias FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_produtos_familias' AND policyname = 'crm_produtos_familias_all_auth'
  ) THEN
    CREATE POLICY crm_produtos_familias_all_auth ON public.crm_produtos_familias FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ADD COLUMN IF NOT EXISTS familia_id UUID;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_produtos_familia_id_fkey'
  ) THEN
    ALTER TABLE public.crm_produtos
      ADD CONSTRAINT crm_produtos_familia_id_fkey
      FOREIGN KEY (familia_id) REFERENCES public.crm_produtos_familias(familia_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_produtos_familia_id ON public.crm_produtos(familia_id)';
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos
    ALTER COLUMN local_estoque SET DEFAULT '03';

  UPDATE public.crm_produtos
     SET local_estoque = CASE
       WHEN local_estoque IN ('03', '04', '05') THEN local_estoque
       WHEN local_estoque = 'INTERNO' THEN '04'
       WHEN local_estoque = 'PADRAO' THEN '03'
       ELSE '03'
     END;

  ALTER TABLE public.crm_produtos
    DROP CONSTRAINT IF EXISTS crm_produtos_local_estoque_check;

  ALTER TABLE public.crm_produtos
    ADD CONSTRAINT crm_produtos_local_estoque_check CHECK (local_estoque IN ('03', '04', '05'));
END $$;

COMMIT;
