CREATE OR REPLACE FUNCTION public.update_group_chat_room(
  room_id uuid,
  room_name text DEFAULT NULL,
  room_description text DEFAULT NULL,
  room_avatar_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_room_admin(room_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.chat_rooms r
  SET
    name = COALESCE(NULLIF(btrim(room_name), ''), r.name),
    description = CASE
      WHEN room_description IS NULL THEN r.description
      ELSE NULLIF(btrim(room_description), '')
    END,
    avatar_path = CASE
      WHEN room_avatar_path IS NULL THEN r.avatar_path
      ELSE NULLIF(btrim(room_avatar_path), '')
    END,
    updated_at = now()
  WHERE r.id = room_id
    AND r.type = 'group';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_chat_room(uuid, text, text, text) TO authenticated;

