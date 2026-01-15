-- FIX: Add RLS Policies Safely (Check if exists)
-- This script safely drops existing policies before creating them to avoid "42710: policy already exists" error.

-- 1. Enable Security (RLS) - Idempotent
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies (Drop first to be safe)
-- Allow users to see ONLY their own notifications
DROP POLICY IF EXISTS "View Own Notifications" ON public.chat_notifications;
DROP POLICY IF EXISTS "Users can view their own chat notifications" ON public.chat_notifications; -- Drop old name too if exists

CREATE POLICY "View Own Notifications" 
  ON public.chat_notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to mark their own notifications as read
DROP POLICY IF EXISTS "Update Own Notifications" ON public.chat_notifications;
DROP POLICY IF EXISTS "Users can update their own chat notifications" ON public.chat_notifications; -- Drop old name too if exists

CREATE POLICY "Update Own Notifications" 
  ON public.chat_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow system/triggers to insert
DROP POLICY IF EXISTS "Insert System Notifications" ON public.chat_notifications;
CREATE POLICY "Insert System Notifications"
  ON public.chat_notifications FOR INSERT
  WITH CHECK (true);

-- 3. Create Automation Trigger (The "Brain")
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

-- Attach the trigger
DROP TRIGGER IF EXISTS trigger_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();
