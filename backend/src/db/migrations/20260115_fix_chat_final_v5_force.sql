-- FIX CHAT FINAL V5 (FORCE REBUILD)
-- Solves 42710 policy already exists errors by strictly dropping everything first.

-- 1. DROP EVERYTHING RELATED TO CHAT PERMISSIONS FIRST
-- We wrap this in a DO block to ensure execution or ignore errors safely if needed,
-- but standard DROP statements are better for migration logs.

DROP POLICY IF EXISTS "View members safe" ON public.chat_room_members;
DROP POLICY IF EXISTS "Enable select for members linked to room" ON public.chat_room_members;
DROP POLICY IF EXISTS "Enable select for members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "View members policy" ON public.chat_room_members;

-- 2. HELPER FUNCTION (Idempotent)
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

-- 3. RECREATE POLICY SAFELY
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View members safe"
ON public.chat_room_members FOR SELECT
USING (
    room_id IN ( SELECT public.get_my_room_ids() )
);

-- 4. ENSURE NOTIFICATIONS TABLE EXISTS
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

-- 5. RECREATE INDEXES (Idempotent)
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_read 
  ON public.chat_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_room
  ON public.chat_notifications(room_id);

-- 6. RECREATE NOTIFICATION POLICIES (Drop first to avoid conflicts)
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

-- 7. RECREATE TRIGGER FUNCTION AND TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- 8. REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;
  END IF;
END $$;
