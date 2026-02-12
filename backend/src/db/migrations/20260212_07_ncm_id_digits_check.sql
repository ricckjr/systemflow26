BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.ncm
    ALTER COLUMN ncm_id TYPE TEXT;
END $$;

DO $$
DECLARE
  v_deleted integer := 0;
  v_rows integer := 0;
BEGIN
  IF to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ncm' AND column_name = 'ncm_id_norm'
  ) THEN
    ALTER TABLE public.ncm ADD COLUMN ncm_id_norm TEXT;
  END IF;

  UPDATE public.ncm
     SET ncm_id_norm = COALESCE(
       CASE
         WHEN regexp_replace(ncm_id, '\D', '', 'g') <> '' AND length(regexp_replace(ncm_id, '\D', '', 'g')) <= 8
           THEN lpad(regexp_replace(ncm_id, '\D', '', 'g'), 8, '0')
         ELSE NULL
       END,
       CASE
         WHEN regexp_replace(codigo, '\D', '', 'g') <> '' AND length(regexp_replace(codigo, '\D', '', 'g')) <= 8
           THEN lpad(regexp_replace(codigo, '\D', '', 'g'), 8, '0')
         ELSE NULL
       END
     );

  DELETE FROM public.ncm
   WHERE ncm_id_norm IS NULL OR ncm_id_norm !~ '^[0-9]{8}$';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted + COALESCE(v_rows, 0);

  DELETE FROM public.ncm a
   USING public.ncm b
   WHERE a.ctid < b.ctid
     AND a.ncm_id_norm = b.ncm_id_norm;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_deleted := v_deleted + COALESCE(v_rows, 0);

  UPDATE public.ncm
     SET ncm_id = ncm_id_norm;

  UPDATE public.ncm
     SET codigo = substr(ncm_id, 1, 4) || '.' || substr(ncm_id, 5, 2) || '.' || substr(ncm_id, 7, 2)
   WHERE ncm_id ~ '^[0-9]{8}$'
     AND (codigo IS NULL OR regexp_replace(codigo, '\D', '', 'g') <> ncm_id);

  ALTER TABLE public.ncm DROP COLUMN IF EXISTS ncm_id_norm;

  ALTER TABLE public.ncm
    ALTER COLUMN ncm_id SET NOT NULL,
    ALTER COLUMN codigo SET NOT NULL,
    ALTER COLUMN descricao SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL;

  IF v_deleted > 0 THEN
    RAISE NOTICE 'public.ncm: removidos % registros inválidos para permitir constraint chk_ncm_id_digits_8', v_deleted;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ncm_id_digits_8') THEN
    ALTER TABLE public.ncm
      ADD CONSTRAINT chk_ncm_id_digits_8 CHECK (ncm_id ~ '^[0-9]{8}$') NOT VALID;
    ALTER TABLE public.ncm VALIDATE CONSTRAINT chk_ncm_id_digits_8;
  END IF;
END $$;

COMMIT;
