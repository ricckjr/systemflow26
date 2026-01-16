BEGIN;

DO $$
BEGIN
  IF to_regclass('public.taskflow_comments') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'user_id'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'created_by'
      ) THEN
        EXECUTE 'ALTER TABLE public.taskflow_comments ADD COLUMN user_id uuid';
        EXECUTE 'UPDATE public.taskflow_comments SET user_id = created_by WHERE user_id IS NULL';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_comments_user_fk') THEN
          EXECUTE 'ALTER TABLE public.taskflow_comments ADD CONSTRAINT taskflow_comments_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taskflow_comments' AND column_name = 'author_id'
      ) THEN
        EXECUTE 'ALTER TABLE public.taskflow_comments ADD COLUMN user_id uuid';
        EXECUTE 'UPDATE public.taskflow_comments SET user_id = author_id WHERE user_id IS NULL';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_comments_user_fk') THEN
          EXECUTE 'ALTER TABLE public.taskflow_comments ADD CONSTRAINT taskflow_comments_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
        END IF;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.taskflow_activity_log') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'taskflow_activity_log' AND column_name = 'user_id'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taskflow_activity_log' AND column_name = 'created_by'
      ) THEN
        EXECUTE 'ALTER TABLE public.taskflow_activity_log ADD COLUMN user_id uuid';
        EXECUTE 'UPDATE public.taskflow_activity_log SET user_id = created_by WHERE user_id IS NULL';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_activity_user_fk') THEN
          EXECUTE 'ALTER TABLE public.taskflow_activity_log ADD CONSTRAINT taskflow_activity_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taskflow_activity_log' AND column_name = 'author_id'
      ) THEN
        EXECUTE 'ALTER TABLE public.taskflow_activity_log ADD COLUMN user_id uuid';
        EXECUTE 'UPDATE public.taskflow_activity_log SET user_id = author_id WHERE user_id IS NULL';
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'taskflow_activity_user_fk') THEN
          EXECUTE 'ALTER TABLE public.taskflow_activity_log ADD CONSTRAINT taskflow_activity_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
        END IF;
      END IF;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tf_can_access_task(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  assignee_col text;
  has_owner boolean;
  has_assignment boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = p_task_id
      AND t.created_by = auth.uid()
  ) INTO has_owner;

  SELECT column_name
  INTO assignee_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'taskflow_task_users'
    AND column_name IN ('user_id','profile_id','assignee_id','usuario_id')
  ORDER BY CASE
    WHEN column_name = 'user_id' THEN 1
    WHEN column_name = 'profile_id' THEN 2
    WHEN column_name = 'assignee_id' THEN 3
    WHEN column_name = 'usuario_id' THEN 4
    ELSE 99
  END
  LIMIT 1;

  IF assignee_col IS NULL THEN
    RETURN has_owner;
  END IF;

  EXECUTE format(
    'SELECT EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = $1 AND tu.%I = auth.uid())',
    assignee_col
  )
  INTO has_assignment
  USING p_task_id;

  RETURN has_owner OR COALESCE(has_assignment, false);
END;
$$;

ALTER TABLE public.taskflow_task_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tf_task_users_select ON public.taskflow_task_users;
CREATE POLICY tf_task_users_select ON public.taskflow_task_users
FOR SELECT USING (public.tf_can_access_task(task_id));

ALTER TABLE public.taskflow_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_tasks_select ON public.taskflow_tasks;
CREATE POLICY tf_tasks_select ON public.taskflow_tasks
FOR SELECT USING (public.tf_can_access_task(id));

ALTER TABLE public.taskflow_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_comments_select ON public.taskflow_comments;
DROP POLICY IF EXISTS tf_comments_insert ON public.taskflow_comments;
CREATE POLICY tf_comments_select ON public.taskflow_comments
FOR SELECT USING (public.tf_can_access_task(task_id));
CREATE POLICY tf_comments_insert ON public.taskflow_comments
FOR INSERT WITH CHECK (public.tf_can_access_task(task_id) AND user_id = auth.uid());

ALTER TABLE public.taskflow_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_attachments_select ON public.taskflow_attachments;
DROP POLICY IF EXISTS tf_attachments_insert ON public.taskflow_attachments;
CREATE POLICY tf_attachments_select ON public.taskflow_attachments
FOR SELECT USING (public.tf_can_access_task(task_id));
CREATE POLICY tf_attachments_insert ON public.taskflow_attachments
FOR INSERT WITH CHECK (public.tf_can_access_task(task_id) AND created_by = auth.uid());

ALTER TABLE public.taskflow_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_activity_select ON public.taskflow_activity_log;
DROP POLICY IF EXISTS tf_activity_insert ON public.taskflow_activity_log;
CREATE POLICY tf_activity_select ON public.taskflow_activity_log
FOR SELECT USING (public.tf_can_access_task(task_id));
CREATE POLICY tf_activity_insert ON public.taskflow_activity_log
FOR INSERT WITH CHECK (public.tf_can_access_task(task_id) AND user_id = auth.uid());

COMMIT;
