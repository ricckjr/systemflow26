BEGIN;

CREATE TABLE IF NOT EXISTS public.ncm (
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ncm_id TEXT NOT NULL,
  CONSTRAINT ncm_pkey PRIMARY KEY (ncm_id),
  CONSTRAINT ncm_cod_sem_mascara_unique UNIQUE (ncm_id),
  CONSTRAINT ncm_codigo_unique UNIQUE (codigo)
);

DO $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT data_type
    INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'ncm'
     AND column_name = 'ncm_id';

  IF v_type IS NULL THEN
    ALTER TABLE public.ncm ADD COLUMN ncm_id TEXT;
  ELSIF v_type <> 'text' THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ncm'
         AND column_name = 'ncm_id_text'
    ) THEN
      ALTER TABLE public.ncm ADD COLUMN ncm_id_text TEXT;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ncm'
         AND column_name = 'cod_sem_mascara'
    ) THEN
      UPDATE public.ncm
         SET ncm_id_text = COALESCE(
           NULLIF(btrim(ncm_id_text), ''),
           CASE
             WHEN cod_sem_mascara IS NULL THEN NULL
             ELSE lpad(cod_sem_mascara::text, 8, '0')
           END,
           NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')
         )
       WHERE ncm_id_text IS NULL OR btrim(ncm_id_text) = '';
    ELSE
      UPDATE public.ncm
         SET ncm_id_text = COALESCE(
           NULLIF(btrim(ncm_id_text), ''),
           NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')
         )
       WHERE ncm_id_text IS NULL OR btrim(ncm_id_text) = '';
    END IF;

    ALTER TABLE public.ncm DROP CONSTRAINT IF EXISTS ncm_pk;
    ALTER TABLE public.ncm DROP CONSTRAINT IF EXISTS ncm_pkey;
    ALTER TABLE public.ncm DROP CONSTRAINT IF EXISTS ncm_cod_sem_mascara_unique;

    ALTER TABLE public.ncm RENAME COLUMN ncm_id TO ncm_id_old;
    ALTER TABLE public.ncm RENAME COLUMN ncm_id_text TO ncm_id;

    ALTER TABLE public.ncm ALTER COLUMN ncm_id SET NOT NULL;
    ALTER TABLE public.ncm ADD CONSTRAINT ncm_pkey PRIMARY KEY (ncm_id);
    ALTER TABLE public.ncm ADD CONSTRAINT ncm_cod_sem_mascara_unique UNIQUE (ncm_id);

    ALTER TABLE public.ncm DROP COLUMN IF EXISTS ncm_id_old;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'ncm'
       AND column_name = 'cod_sem_mascara'
  ) THEN
    ALTER TABLE public.ncm DROP COLUMN cod_sem_mascara;
  END IF;

  ALTER TABLE public.ncm DROP CONSTRAINT IF EXISTS ncm_codigo_unique;
  ALTER TABLE public.ncm ADD CONSTRAINT ncm_codigo_unique UNIQUE (codigo);

  ALTER TABLE public.ncm DROP CONSTRAINT IF EXISTS ncm_codigo_unique_unique;
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

