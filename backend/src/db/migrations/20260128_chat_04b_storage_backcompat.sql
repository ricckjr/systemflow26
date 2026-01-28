CREATE OR REPLACE FUNCTION public.chat_can_access_attachment(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.is_room_member(public.try_uuid(split_part(object_name, '/', 1)))
    OR EXISTS (
      SELECT 1
      FROM public.chat_messages msg
      WHERE public.is_room_member(msg.room_id)
        AND msg.attachments IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(msg.attachments) a
          WHERE (a ->> 'path') = object_name
        )
    );
$$;

DROP POLICY IF EXISTS "Chat members can view attachments" ON storage.objects;
CREATE POLICY "Chat members can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.chat_can_access_attachment(name)
);
