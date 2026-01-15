-- FIX CHAT FINAL V4
-- Resolves:
-- 1. Missing 'chat_notifications' table (dropped by cascade in v3_rebuild)
-- 2. Infinite recursion in 'chat_room_members' RLS
-- 3. Missing triggers for notifications

-- ==============================================================================
-- 1. HELPER FUNCTION TO BREAK RECURSION
-- ==============================================================================
-- This function runs as SUPERUSER (SECURITY DEFINER) to bypass RLS when checking membership.
CREATE OR REPLACE FUNCTION public.get_my_room_ids()
RETURNS TABLE (room_id UUID) 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
AS $$
  SELECT room_id 
  FROM public.chat_room_members 
  WHERE user_id = auth.uid();
$$;

-- ==============================================================================
-- 2. FIX RLS ON CHAT_ROOM_MEMBERS
-- ==============================================================================
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for members linked to room" ON public.chat_room_members;
DROP POLICY IF EXISTS "Enable select for members" ON public.chat_room_members;
DROP POLICY IF EXISTS "View members safe" ON public.chat_room_members;

-- Safe Policy: Users can view members of rooms they belong to (using the helper)
CREATE POLICY "View members safe"
ON public.chat_room_members FOR SELECT
USING (
    room_id IN ( SELECT public.get_my_room_ids() )
);

-- ==============================================================================
-- 3. CREATE CHAT_NOTIFICATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('message', 'mention', 'reply')) DEFAULT 'message',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_read 
  ON public.chat_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_room
  ON public.chat_notifications(room_id);

-- RLS for Notifications
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Own Notifications" ON public.chat_notifications;
CREATE POLICY "View Own Notifications" 
  ON public.chat_notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update Own Notifications" ON public.chat_notifications;
CREATE POLICY "Update Own Notifications" 
  ON public.chat_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert System Notifications" ON public.chat_notifications;
CREATE POLICY "Insert System Notifications"
  ON public.chat_notifications FOR INSERT
  WITH CHECK (true);

-- ==============================================================================
-- 4. TRIGGER FOR NOTIFICATIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a notification for every member of the room (except the sender)
  INSERT INTO public.chat_notifications (user_id, room_id, message_id, sender_id, type)
  SELECT user_id, NEW.room_id, NEW.id, NEW.sender_id, 'message'
  FROM public.chat_room_members
  WHERE room_id = NEW.room_id 
    AND user_id != NEW.sender_id
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();

-- ==============================================================================
-- 5. REALTIME
-- ==============================================================================
-- Ensure chat_notifications is in the publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;
  END IF;
END $$;
