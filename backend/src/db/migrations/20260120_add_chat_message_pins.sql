-- Chat pins (messages fixed at top)

CREATE TABLE IF NOT EXISTS public.chat_message_pins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_message_pins_room_message
  ON public.chat_message_pins(room_id, message_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_pins_room_pinned_at
  ON public.chat_message_pins(room_id, pinned_at DESC);

ALTER TABLE public.chat_message_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view pins" ON public.chat_message_pins;
CREATE POLICY "Members can view pins"
  ON public.chat_message_pins FOR SELECT
  USING (public.is_room_member(room_id));

DROP POLICY IF EXISTS "Members can pin messages" ON public.chat_message_pins;
CREATE POLICY "Members can pin messages"
  ON public.chat_message_pins FOR INSERT
  WITH CHECK (
    public.is_room_member(room_id)
    AND auth.uid() = pinned_by
  );

DROP POLICY IF EXISTS "Members can unpin messages" ON public.chat_message_pins;
CREATE POLICY "Members can unpin messages"
  ON public.chat_message_pins FOR DELETE
  USING (
    public.is_room_member(room_id)
    AND (auth.uid() = pinned_by OR public.is_room_admin(room_id))
  );

