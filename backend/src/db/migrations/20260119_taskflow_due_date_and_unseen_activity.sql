ALTER TABLE public.taskflow_tasks
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.taskflow_tasks
   SET last_activity_at = COALESCE(last_activity_at, updated_at, created_at, now());

ALTER TABLE public.taskflow_tasks
  ALTER COLUMN last_activity_at SET DEFAULT now();

ALTER TABLE public.taskflow_tasks
  ALTER COLUMN last_activity_at SET NOT NULL;

UPDATE public.taskflow_tasks
   SET due_date = COALESCE(
     due_date,
     (date_trunc('day', created_at) + interval '8 days' - interval '1 millisecond')
   );

ALTER TABLE public.taskflow_tasks
  ALTER COLUMN due_date SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'taskflow_tasks' THEN
    NEW.last_activity_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.taskflow_task_seen (
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.taskflow_task_seen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'taskflow_task_seen' AND policyname = 'tf_task_seen_select') THEN
    CREATE POLICY tf_task_seen_select ON public.taskflow_task_seen
      FOR SELECT
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.taskflow_tasks t
          WHERE t.id = taskflow_task_seen.task_id
            AND (
              t.created_by = auth.uid()
              OR EXISTS (
                SELECT 1
                FROM public.taskflow_task_users tu
                WHERE tu.task_id = t.id
                  AND tu.user_id = auth.uid()
              )
            )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'taskflow_task_seen' AND policyname = 'tf_task_seen_upsert') THEN
    CREATE POLICY tf_task_seen_upsert ON public.taskflow_task_seen
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.taskflow_tasks t
          WHERE t.id = taskflow_task_seen.task_id
            AND (
              t.created_by = auth.uid()
              OR EXISTS (
                SELECT 1
                FROM public.taskflow_task_users tu
                WHERE tu.task_id = t.id
                  AND tu.user_id = auth.uid()
              )
            )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'taskflow_task_seen' AND policyname = 'tf_task_seen_update') THEN
    CREATE POLICY tf_task_seen_update ON public.taskflow_task_seen
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tf_mark_task_seen(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.taskflow_task_seen(task_id, user_id, last_seen_at)
  VALUES (p_task_id, auth.uid(), now())
  ON CONFLICT (task_id, user_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.tf_touch_task_last_activity_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  task_id uuid;
BEGIN
  task_id := COALESCE(NEW.task_id, OLD.task_id);
  UPDATE public.taskflow_tasks
     SET last_activity_at = now()
   WHERE id = task_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_comments_touch_task') THEN
    CREATE TRIGGER tf_comments_touch_task
      AFTER INSERT ON public.taskflow_comments
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_activity_touch_task') THEN
    CREATE TRIGGER tf_activity_touch_task
      AFTER INSERT ON public.taskflow_activity_log
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_task_users_touch_task_ins') THEN
    CREATE TRIGGER tf_task_users_touch_task_ins
      AFTER INSERT ON public.taskflow_task_users
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_task_users_touch_task_del') THEN
    CREATE TRIGGER tf_task_users_touch_task_del
      AFTER DELETE ON public.taskflow_task_users
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_attachments_touch_task_ins') THEN
    CREATE TRIGGER tf_attachments_touch_task_ins
      AFTER INSERT ON public.taskflow_attachments
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_attachments_touch_task_upd') THEN
    CREATE TRIGGER tf_attachments_touch_task_upd
      AFTER UPDATE ON public.taskflow_attachments
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tf_attachments_touch_task_del') THEN
    CREATE TRIGGER tf_attachments_touch_task_del
      AFTER DELETE ON public.taskflow_attachments
      FOR EACH ROW EXECUTE FUNCTION public.tf_touch_task_last_activity_trigger();
  END IF;
END $$;

