ALTER TABLE public.chat_rooms
ADD COLUMN IF NOT EXISTS avatar_path text;

DROP POLICY IF EXISTS "Members can update room metadata" ON public.chat_rooms;
DROP POLICY IF EXISTS "Admins can update room metadata" ON public.chat_rooms;

CREATE POLICY "Admins can update room metadata"
  ON public.chat_rooms FOR UPDATE
  TO authenticated
  USING (public.is_room_admin(id))
  WITH CHECK (public.is_room_admin(id));

