-- Chat: secure storage (private buckets + membership-based policies)

CREATE OR REPLACE FUNCTION public.try_uuid(input text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN input::uuid;
EXCEPTION
  WHEN others THEN
    RETURN null;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-room-avatars',
  'chat-room-avatars',
  false,
  5242880,
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880;

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;

DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;

DROP POLICY IF EXISTS "Chat members can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Chat members can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Chat uploaders can delete attachments" ON storage.objects;

CREATE POLICY "Chat members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_room_member(public.try_uuid(split_part(name, '/', 1)))
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Chat members can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_room_member(public.try_uuid(split_part(name, '/', 1)))
);

CREATE POLICY "Chat uploaders can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Chat admins can upload room avatars" ON storage.objects;
DROP POLICY IF EXISTS "Chat members can view room avatars" ON storage.objects;
DROP POLICY IF EXISTS "Chat uploaders can delete room avatars" ON storage.objects;

CREATE POLICY "Chat admins can upload room avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-room-avatars'
  AND public.is_room_admin(public.try_uuid(split_part(name, '/', 1)))
);

CREATE POLICY "Chat members can view room avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-room-avatars'
  AND public.is_room_member(public.try_uuid(split_part(name, '/', 1)))
);

CREATE POLICY "Chat uploaders can delete room avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-room-avatars'
  AND owner = auth.uid()
);

