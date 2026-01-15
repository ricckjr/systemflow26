-- Chat System Schema for SystemFlow (Hardened for Supabase)

-- 0) Extensions (if needed)
-- create extension if not exists pgcrypto;

-- 1) Create Tables

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'crm_deal')),
    name TEXT,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::JSONB,
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_room_members (
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ,
    is_edited BOOLEAN DEFAULT FALSE,
    attachments JSONB[] DEFAULT ARRAY[]::JSONB[],
    reply_to_id UUID REFERENCES public.chat_messages(id)
);

-- 2) Indexes

CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at
  ON public.chat_rooms(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_metadata
  ON public.chat_rooms USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id
  ON public.chat_room_members(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id
  ON public.chat_room_members(room_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
  ON public.chat_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON public.chat_messages(sender_id);

-- 3) RLS

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: membership check (safe for RLS)
CREATE OR REPLACE FUNCTION public.is_room_member(check_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- Added security definer to ensure consistent lookup
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members m
    WHERE m.room_id = check_room_id
      AND m.user_id = auth.uid()
  );
$$;

-- Helper: role check for admin/owner
CREATE OR REPLACE FUNCTION public.is_room_admin(check_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- Added security definer to ensure consistent lookup
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members m
    WHERE m.room_id = check_room_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner','admin')
  );
$$;

-- Chat Rooms Policies

DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
CREATE POLICY "Users can view rooms they are members of"
  ON public.chat_rooms FOR SELECT
  USING (public.is_room_member(id));

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Update: only members, and keep membership valid
DROP POLICY IF EXISTS "Members can update room metadata" ON public.chat_rooms;
CREATE POLICY "Members can update room metadata"
  ON public.chat_rooms FOR UPDATE
  USING (public.is_room_member(id))
  WITH CHECK (public.is_room_member(id));

-- Chat Room Members Policies

DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;
CREATE POLICY "Users can view members of their rooms"
  ON public.chat_room_members FOR SELECT
  USING (
    public.is_room_member(room_id)
    OR user_id = auth.uid()
  );

-- INSERT members:
-- - allow self-join only if already member? (usually NO)
-- - allow admin/owner to add others (YES)
DROP POLICY IF EXISTS "Users can join rooms (or be added)" ON public.chat_room_members;
CREATE POLICY "Room admins can add members"
  ON public.chat_room_members FOR INSERT
  WITH CHECK (
    -- Allow user adding themselves ONLY if you want "self-join"
    -- auth.uid() = user_id

    -- Recommended: only admin/owner can add anyone (including themselves if needed)
    public.is_room_admin(room_id)
    OR (auth.uid() = user_id AND public.is_room_admin(room_id)) -- creator flow / admin self-add
  );

-- Optional: allow user to update only their own last_read_at (read receipt)
DROP POLICY IF EXISTS "User can update own membership" ON public.chat_room_members;
CREATE POLICY "User can update own membership"
  ON public.chat_room_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Chat Messages Policies

DROP POLICY IF EXISTS "Members can view messages" ON public.chat_messages;
CREATE POLICY "Members can view messages"
  ON public.chat_messages FOR SELECT
  USING (public.is_room_member(room_id));

DROP POLICY IF EXISTS "Members can insert messages" ON public.chat_messages;
CREATE POLICY "Members can insert messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    public.is_room_member(room_id)
    AND auth.uid() = sender_id
  );

-- Update only if sender AND member of the room
DROP POLICY IF EXISTS "Senders can edit their own messages" ON public.chat_messages;
CREATE POLICY "Senders can edit their own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
  );

-- (Optional) Delete: only sender and member
DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.chat_messages;
CREATE POLICY "Senders can delete their own messages"
  ON public.chat_messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
  );

-- 4) Realtime Configuration
-- NOTE: This will error if the table is already in the publication.
-- Run once, or check first in Dashboard > Database > Replication.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;

-- 5) Triggers

-- Update last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_rooms
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Added SECURITY DEFINER to ensure system updates bypass RLS

DROP TRIGGER IF EXISTS trigger_update_room_last_message ON public.chat_messages;
CREATE TRIGGER trigger_update_room_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_room_last_message();

-- Auto add creator as member (owner)
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
      RETURN NEW;
    END IF;

    -- Using SECURITY DEFINER allows bypassing the INSERT policy on chat_room_members
    -- which requires is_room_admin (which the user isn't yet)
    INSERT INTO public.chat_room_members (room_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- CRITICAL: Added SECURITY DEFINER to bypass insert policy for creator

DROP TRIGGER IF EXISTS trigger_add_creator_as_member ON public.chat_rooms;
CREATE TRIGGER trigger_add_creator_as_member
AFTER INSERT ON public.chat_rooms
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_member();
