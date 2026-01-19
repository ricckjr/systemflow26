-- Fix ambiguous column reference in receipts RPCs (PL/pgSQL params vs table columns)

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

