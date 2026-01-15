-- RPC para retornar o total de notificações de chat não-lidas
-- Motivo: em alguns cenários (proxy/CDN), o header Content-Range não fica exposto no CORS,
-- quebrando contadores baseados em `count` do PostgREST no browser.

CREATE OR REPLACE FUNCTION public.get_unread_chat_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(*)::integer
  FROM public.chat_notifications
  WHERE user_id = auth.uid()
    AND is_read = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_chat_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_chat_notification_count() TO service_role;

