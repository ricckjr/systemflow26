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

  GRANT INSERT ON TABLE public.profiles TO authenticated;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/png', 'image/jpeg'])
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg'];

  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_authenticated_upload" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_authenticated_select" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;

  CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');

  CREATE POLICY "avatars_authenticated_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND name LIKE 'avatars/' || auth.uid()::text || '-%'
    );

  CREATE POLICY "avatars_authenticated_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND owner = auth.uid()
      AND name LIKE 'avatars/' || auth.uid()::text || '-%'
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND owner = auth.uid()
      AND name LIKE 'avatars/' || auth.uid()::text || '-%'
    );

  CREATE POLICY "avatars_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND owner = auth.uid()
      AND name LIKE 'avatars/' || auth.uid()::text || '-%'
    );
END $$;

COMMIT;
