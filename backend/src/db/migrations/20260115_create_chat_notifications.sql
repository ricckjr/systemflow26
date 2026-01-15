-- 1. Create specialized table for chat notifications
CREATE TABLE IF NOT EXISTS public.chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,     -- Recipient
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,   -- Room
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE, -- Source Message
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- Sender
  
  type text NOT NULL CHECK (type IN ('message', 'mention', 'reply')) DEFAULT 'message',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_notifications_user_read 
  ON public.chat_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_room
  ON public.chat_notifications(room_id);

-- 3. RLS Policies
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chat notifications" ON public.chat_notifications;
CREATE POLICY "Users can view their own chat notifications" 
  ON public.chat_notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat notifications" ON public.chat_notifications;
CREATE POLICY "Users can update their own chat notifications" 
  ON public.chat_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Trigger to Auto-Generate Notifications
-- This trigger runs after a message is inserted.
-- It notifies ALL other members of the room (except the sender).
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_id uuid;
BEGIN
  -- Loop through all members of the room except the sender
  FOR recipient_id IN 
    SELECT user_id FROM public.chat_room_members 
    WHERE room_id = NEW.room_id 
    AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.chat_notifications (user_id, room_id, message_id, sender_id, type)
    VALUES (recipient_id, NEW.room_id, NEW.id, NEW.sender_id, 'message');
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();
