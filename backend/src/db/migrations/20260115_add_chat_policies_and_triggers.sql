-- FIX: Add RLS Policies and Triggers to existing table
-- You already created the table, but it likely lacks Security Policies (RLS) and the Automation Trigger.

-- 1. Enable Security (RLS)
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies (Who can see what?)
-- Allow users to see ONLY their own notifications
DROP POLICY IF EXISTS "Users can view their own chat notifications" ON public.chat_notifications;
CREATE POLICY "Users can view their own chat notifications" 
  ON public.chat_notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to mark their own notifications as read
DROP POLICY IF EXISTS "Users can update their own chat notifications" ON public.chat_notifications;
CREATE POLICY "Users can update their own chat notifications" 
  ON public.chat_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create Automation Trigger (The "Brain")
-- This ensures notifications are actually created when a message is sent.
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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

-- Attach the trigger to the messages table
DROP TRIGGER IF EXISTS trigger_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();
