DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_notifications'
  ) THEN
    RAISE NOTICE 'chat_notifications table not found; skipping ensure_chat_notifications_realtime';
    RETURN;
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;
  END IF;
END $$;
