ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_member(check_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members m
    WHERE m.room_id = check_room_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_admin(check_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members m
    WHERE m.room_id = check_room_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin')
  );
$$;

DROP POLICY IF EXISTS "Enable select for members linked to room" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "View members policy" ON public.chat_room_members;
DROP POLICY IF EXISTS "View members safe" ON public.chat_room_members;

DROP POLICY IF EXISTS "Enable insert for room admins" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can join rooms (or be added)" ON public.chat_room_members;
DROP POLICY IF EXISTS "Room admins can add members" ON public.chat_room_members;

DROP POLICY IF EXISTS "User can update own membership" ON public.chat_room_members;

DROP POLICY IF EXISTS "Users can leave rooms" ON public.chat_room_members;

CREATE POLICY "Chat members can view members"
  ON public.chat_room_members FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id));

CREATE POLICY "Room admins can add members"
  ON public.chat_room_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_room_admin(room_id)
    AND user_id IS NOT NULL
  );

CREATE POLICY "User can update own membership"
  ON public.chat_room_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

