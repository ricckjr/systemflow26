CREATE OR REPLACE FUNCTION public.create_group_chat_room(
  room_name text,
  room_description text DEFAULT NULL,
  member_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  rid uuid;
  cleaned_name text;
  cleaned_desc text;
  member_id uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  cleaned_name := btrim(coalesce(room_name, ''));
  IF cleaned_name = '' THEN
    RAISE EXCEPTION 'Nome do grupo é obrigatório';
  END IF;

  cleaned_desc := nullif(btrim(coalesce(room_description, '')), '');

  INSERT INTO public.chat_rooms (type, name, description, created_by, metadata)
  VALUES ('group', cleaned_name, cleaned_desc, uid, '{}'::jsonb)
  RETURNING id INTO rid;

  INSERT INTO public.chat_room_members (room_id, user_id, role)
  VALUES (rid, uid, 'owner')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  FOREACH member_id IN ARRAY member_ids LOOP
    IF member_id IS NULL THEN
      CONTINUE;
    END IF;
    IF member_id = uid THEN
      CONTINUE;
    END IF;
    INSERT INTO public.chat_room_members (room_id, user_id, role)
    VALUES (rid, member_id, 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END LOOP;

  RETURN rid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_chat_room(text, text, uuid[]) TO authenticated;
