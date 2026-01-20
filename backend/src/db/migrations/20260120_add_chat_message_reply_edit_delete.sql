-- Reply/Edit/Delete (soft delete) for chat_messages

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id
  ON public.chat_messages(reply_to_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_at
  ON public.chat_messages(deleted_at);

-- RLS update rules:
-- - Edit: only sender, member, not deleted, within 15 minutes
-- - Soft delete: only sender, member, not already deleted (no time limit)

DROP POLICY IF EXISTS "Senders can edit their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Senders can edit their own messages (15min)" ON public.chat_messages;
DROP POLICY IF EXISTS "Senders can soft delete their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.chat_messages;

CREATE POLICY "Senders can edit their own messages (15min)"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
    AND deleted_at IS NULL
    AND (NOW() - created_at) <= INTERVAL '15 minutes'
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
    AND deleted_at IS NULL
    AND (NOW() - created_at) <= INTERVAL '15 minutes'
  );

CREATE POLICY "Senders can soft delete their own messages"
  ON public.chat_messages FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_room_member(room_id)
    AND deleted_at IS NOT NULL
  );

