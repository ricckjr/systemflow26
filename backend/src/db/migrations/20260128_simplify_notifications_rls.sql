BEGIN;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', r.policyname);
  END LOOP;
END $$;

CREATE POLICY notifications_select ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY notifications_insert ON public.notifications
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_delete ON public.notifications
FOR DELETE
USING (user_id = auth.uid());

COMMIT;

