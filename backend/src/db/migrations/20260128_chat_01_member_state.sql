-- Chat: per-user room state (hide/delete-for-me + clear history)

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_hidden_at
  ON public.chat_room_members(user_id, hidden_at);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_cleared_at
  ON public.chat_room_members(user_id, cleared_at);

CREATE OR REPLACE FUNCTION public.chat_hide_room(room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_room_members m
  SET hidden_at = now()
  WHERE m.room_id = $1
    AND m.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_clear_room_history(room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_room_members m
  SET
    cleared_at = now(),
    hidden_at = null
  WHERE m.room_id = $1
    AND m.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_unhide_room_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_room_members m
  SET hidden_at = null
  WHERE m.room_id = NEW.room_id
    AND m.user_id != NEW.sender_id
    AND m.hidden_at IS NOT NULL
    AND NEW.created_at > m.hidden_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_unhide_room_on_new_message ON public.chat_messages;
CREATE TRIGGER trigger_chat_unhide_room_on_new_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.chat_unhide_room_on_new_message();

