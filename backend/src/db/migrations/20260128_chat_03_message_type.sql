-- Chat: message types for media support

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'file', 'audio'));

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_type_created
  ON public.chat_messages(room_id, message_type, created_at DESC);

