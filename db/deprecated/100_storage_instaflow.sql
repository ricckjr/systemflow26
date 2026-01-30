-- Bucket creation (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('instaflow', 'instaflow', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- RLS on storage objects (managed by Supabase; do not ALTER ownership-controlled tables)

-- Policies (idempotent)
DROP POLICY IF EXISTS instaflow_read ON storage.objects;
DROP POLICY IF EXISTS instaflow_insert ON storage.objects;
DROP POLICY IF EXISTS instaflow_update ON storage.objects;
DROP POLICY IF EXISTS instaflow_delete ON storage.objects;

CREATE POLICY instaflow_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'instaflow');

CREATE POLICY instaflow_insert
ON storage.objects
FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'instaflow');

CREATE POLICY instaflow_update
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'instaflow'
  AND (
    auth.uid() = owner
    OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  )
)
WITH CHECK (
  bucket_id = 'instaflow'
  AND (
    auth.uid() = owner
    OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  )
);

CREATE POLICY instaflow_delete
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'instaflow'
  AND (
    auth.uid() = owner
    OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.cargo = 'ADMIN')
  )
);
