BEGIN;

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.notifications
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin
  ON public.notifications USING GIN (metadata);

CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  trimmed text;
  preview text;
  first_type text;
BEGIN
  SELECT COALESCE(NULLIF(btrim(p.nome), ''), 'Alguém')
  INTO sender_name
  FROM public.profiles p
  WHERE p.id = NEW.sender_id;

  trimmed := btrim(COALESCE(NEW.content, ''));

  IF trimmed <> '' THEN
    preview := left(trimmed, 90);
  ELSE
    first_type := NULL;
    IF array_length(NEW.attachments, 1) >= 1 THEN
      first_type := (NEW.attachments[1] ->> 'type');
    END IF;

    preview := CASE first_type
      WHEN 'audio' THEN '🎵 Áudio'
      WHEN 'image' THEN '🖼️ Imagem'
      WHEN 'video' THEN '🎬 Vídeo'
      WHEN 'document' THEN '📄 Documento'
      ELSE '📎 Anexo'
    END;
  END IF;

  FOR recipient_id IN
    SELECT user_id
    FROM public.chat_room_members
    WHERE room_id = NEW.room_id
      AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, title, content, link, type, is_read, metadata)
    VALUES (
      recipient_id,
      'Nova mensagem',
      sender_name || ': ' || preview,
      '/app/comunicacao/chat?room=' || NEW.room_id::text || '&message=' || NEW.id::text,
      'chat',
      false,
      jsonb_build_object(
        'room_id', NEW.room_id,
        'sender_id', NEW.sender_id,
        'message_id', NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;

