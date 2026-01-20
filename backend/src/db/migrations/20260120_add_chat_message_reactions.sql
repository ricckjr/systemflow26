-- Chat message reactions (emoji)

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_room_message
  ON public.chat_message_reactions(room_id, message_id);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reactions" ON public.chat_message_reactions;
CREATE POLICY "Members can view reactions"
  ON public.chat_message_reactions FOR SELECT
  USING (public.is_room_member(room_id));

DROP POLICY IF EXISTS "Members can add reactions" ON public.chat_message_reactions;
CREATE POLICY "Members can add reactions"
  ON public.chat_message_reactions FOR INSERT
  WITH CHECK (
    public.is_room_member(room_id)
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.chat_message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON public.chat_message_reactions FOR DELETE
  USING (
    public.is_room_member(room_id)
    AND auth.uid() = user_id
  );

