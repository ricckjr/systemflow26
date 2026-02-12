BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.ncm ENABLE ROW LEVEL SECURITY;

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ncm TO authenticated';
  EXECUTE 'GRANT SELECT ON TABLE public.ncm TO anon';
END $$;

DO $$
BEGIN
  IF to_regclass('public.ncm') IS NULL THEN
    RETURN;
  END IF;

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

