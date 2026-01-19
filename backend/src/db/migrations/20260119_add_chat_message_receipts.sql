-- Chat Message Receipts (sent/delivered/read) - WhatsApp-like ticks

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_room
  ON public.chat_message_receipts(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_message
  ON public.chat_message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_user
  ON public.chat_message_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_user_pending_delivered
  ON public.chat_message_receipts(user_id)
  WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_user_pending_read
  ON public.chat_message_receipts(user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.chat_message_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view receipts" ON public.chat_message_receipts;
CREATE POLICY "Members can view receipts"
  ON public.chat_message_receipts FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id));

DROP POLICY IF EXISTS "Recipients can update own receipts" ON public.chat_message_receipts;
CREATE POLICY "Recipients can update own receipts"
  ON public.chat_message_receipts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_chat_message_receipts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_id uuid;
BEGIN
  FOR recipient_id IN
    SELECT user_id
    FROM public.chat_room_members
    WHERE room_id = NEW.room_id
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.chat_message_receipts (message_id, room_id, user_id)
    VALUES (NEW.id, NEW.room_id, recipient_id)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_chat_message_receipts ON public.chat_messages;
CREATE TRIGGER trigger_create_chat_message_receipts
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message_receipts();

CREATE OR REPLACE FUNCTION public.mark_message_delivered(message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_message_receipts
  SET delivered_at = now()
  WHERE user_id = auth.uid()
    AND public.chat_message_receipts.message_id = $1
    AND delivered_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_delivered()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_message_receipts
  SET delivered_at = now()
  WHERE user_id = auth.uid()
    AND delivered_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_room_read(room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_message_receipts
  SET
    delivered_at = COALESCE(delivered_at, now()),
    read_at = now()
  WHERE user_id = auth.uid()
    AND public.chat_message_receipts.room_id = $1
    AND read_at IS NULL;
END;
$$;

-- Optional: enable realtime for receipts (may require manual addition in Supabase dashboard)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_receipts;
