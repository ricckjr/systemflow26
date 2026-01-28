ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.force_chat_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_chat_created_by ON public.chat_rooms;
CREATE TRIGGER trg_force_chat_created_by
BEFORE INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.force_chat_created_by();

CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_room_members (room_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_add_creator_as_member ON public.chat_rooms;
CREATE TRIGGER trigger_add_creator_as_member
AFTER INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_member();

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.chat_rooms;

CREATE POLICY "Authenticated users can create rooms"
  ON public.chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (true);
