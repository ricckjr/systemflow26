CREATE TABLE IF NOT EXISTS public.chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('message', 'mention', 'reply')) DEFAULT 'message',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View Own Notifications" ON public.chat_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update Own Notifications" ON public.chat_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);