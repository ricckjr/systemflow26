BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
  CREATE POLICY profiles_self_insert
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

  DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
  CREATE POLICY profiles_self_update
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  GRANT INSERT (id, nome, email_login, email_corporativo, telefone, ramal, avatar_url, ativo)
    ON TABLE public.profiles TO authenticated;

  GRANT UPDATE (nome, email_corporativo, telefone, ramal, avatar_url)
    ON TABLE public.profiles TO authenticated;
END $$;

COMMIT;
