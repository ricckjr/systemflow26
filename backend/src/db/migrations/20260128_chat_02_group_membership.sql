-- Chat: group membership management (remove/leave)

DROP POLICY IF EXISTS "Room admins can remove members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.chat_room_members;

CREATE POLICY "Room admins can remove members"
  ON public.chat_room_members FOR DELETE
  TO authenticated
  USING (
    public.is_room_admin(room_id)
    AND role <> 'owner'
  );

CREATE POLICY "Users can leave rooms"
  ON public.chat_room_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      role <> 'owner'
      OR (
        role = 'owner'
        AND EXISTS (
          SELECT 1
          FROM public.chat_room_members m2
          WHERE m2.room_id = chat_room_members.room_id
            AND m2.user_id <> auth.uid()
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.leave_chat_room(room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_role text;
  next_owner uuid;
BEGIN
  SELECT m.role
  INTO current_role
  FROM public.chat_room_members m
  WHERE m.room_id = $1
    AND m.user_id = auth.uid();

  IF current_role IS NULL THEN
    RETURN;
  END IF;

  IF current_role = 'owner' THEN
    SELECT m.user_id
    INTO next_owner
    FROM public.chat_room_members m
    WHERE m.room_id = $1
      AND m.user_id <> auth.uid()
    ORDER BY
      (m.role = 'admin') DESC,
      m.joined_at ASC
    LIMIT 1;

    IF next_owner IS NULL THEN
      DELETE FROM public.chat_rooms r
      WHERE r.id = $1
        AND r.created_by = auth.uid();
      RETURN;
    END IF;

    UPDATE public.chat_room_members m
    SET role = 'owner'
    WHERE m.room_id = $1
      AND m.user_id = next_owner;
  END IF;

  DELETE FROM public.chat_room_members m
  WHERE m.room_id = $1
    AND m.user_id = auth.uid();
END;
$$;

