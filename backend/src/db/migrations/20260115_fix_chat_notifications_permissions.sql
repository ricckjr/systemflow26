-- FIX: Permissions and RLS for chat_notifications
-- The net::ERR_ABORTED error often comes from missing GRANT permissions or strict RLS.

-- 1. Grant Permissions to authenticated users (Critical step usually missed)
-- Without this, even with RLS, the API cannot access the table.
GRANT ALL ON TABLE public.chat_notifications TO authenticated;
GRANT ALL ON TABLE public.chat_notifications TO service_role;

-- 2. Ensure RLS is enabled
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Re-verify Policies (Idempotent)
DROP POLICY IF EXISTS "View Own Notifications" ON public.chat_notifications;
CREATE POLICY "View Own Notifications" 
  ON public.chat_notifications FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update Own Notifications" ON public.chat_notifications;
CREATE POLICY "Update Own Notifications" 
  ON public.chat_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert System Notifications" ON public.chat_notifications;
CREATE POLICY "Insert System Notifications"
  ON public.chat_notifications FOR INSERT
  WITH CHECK (true);
