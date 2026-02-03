BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ncm'
  ) THEN
    CREATE TABLE public.ncm (
      ncm_id uuid not null default gen_random_uuid (),
      codigo text not null,
      descricao text not null,
      created_at timestamp with time zone not null default now(),
      cod_sem_mascara numeric null,
      constraint ncm_pk primary key (ncm_id),
      constraint ncm_codigo_unique unique (codigo)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'ncm_id'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN ncm_id uuid;
    UPDATE public.ncm SET ncm_id = gen_random_uuid() WHERE ncm_id IS NULL;
    ALTER TABLE public.ncm ALTER COLUMN ncm_id SET DEFAULT gen_random_uuid();
    ALTER TABLE public.ncm ALTER COLUMN ncm_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN codigo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN descricao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN created_at timestamptz not null default now();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'cod_sem_mascara'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN cod_sem_mascara numeric null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'ncm'
      AND c.contype = 'p'
      AND c.conname <> 'ncm_pk'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE public.ncm DROP CONSTRAINT %I', c.conname)
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'ncm'
        AND c.contype = 'p'
        AND c.conname <> 'ncm_pk'
      LIMIT 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'ncm'
      AND c.contype = 'p'
      AND c.conname = 'ncm_pk'
  ) THEN
    ALTER TABLE public.ncm ADD CONSTRAINT ncm_pk PRIMARY KEY (ncm_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ncm_codigo_unique'
  ) THEN
    ALTER TABLE public.ncm ADD CONSTRAINT ncm_codigo_unique UNIQUE (codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ncm_codigo ON public.ncm USING btree (codigo);

ALTER TABLE public.ncm ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ncm' AND policyname = 'ncm_select_auth'
  ) THEN
    CREATE POLICY ncm_select_auth ON public.ncm FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ncm' AND policyname = 'ncm_all_auth'
  ) THEN
    CREATE POLICY ncm_all_auth ON public.ncm FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
