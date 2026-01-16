BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TRIGGER IF EXISTS task_assignment_notify ON public.taskflow_task_users;
DROP TRIGGER IF EXISTS task_comment_notify ON public.taskflow_comments;

DROP FUNCTION IF EXISTS public.notify_task_assignment();
DROP FUNCTION IF EXISTS public.notify_task_comment();

DROP TABLE IF EXISTS public.taskflow_activity_log CASCADE;
DROP TABLE IF EXISTS public.taskflow_attachments CASCADE;
DROP TABLE IF EXISTS public.taskflow_comments CASCADE;
DROP TABLE IF EXISTS public.taskflow_task_users CASCADE;
DROP TABLE IF EXISTS public.taskflow_calendar CASCADE;
DROP TABLE IF EXISTS public.taskflow_tasks CASCADE;
DROP TABLE IF EXISTS public.taskflow_columns CASCADE;
DROP TABLE IF EXISTS public.taskflow_boards CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.taskflow_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.taskflow_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.taskflow_boards(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.taskflow_columns(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_task_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'assignee' CHECK (role IN ('assignee','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id, role)
);

CREATE TABLE public.taskflow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taskflow_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  link text,
  type text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tf_columns_board_idx ON public.taskflow_columns(board_id, order_index);
CREATE INDEX tf_tasks_board_col_idx ON public.taskflow_tasks(board_id, column_id);
CREATE INDEX tf_task_users_task_idx ON public.taskflow_task_users(task_id);
CREATE INDEX tf_comments_task_idx ON public.taskflow_comments(task_id, created_at);
CREATE INDEX tf_attachments_task_idx ON public.taskflow_attachments(task_id, created_at);
CREATE INDEX tf_activity_task_idx ON public.taskflow_activity_log(task_id, created_at);
CREATE INDEX idx_calendar_user ON public.taskflow_calendar(user_id, start_at);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

ALTER TABLE public.taskflow_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_task_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_insert ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_update ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_delete ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_insert ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_update ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_delete ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_tasks_select ON public.taskflow_tasks;
DROP POLICY IF EXISTS tf_tasks_insert ON public.taskflow_tasks;
DROP POLICY IF EXISTS tf_tasks_update ON public.taskflow_tasks;
DROP POLICY IF EXISTS tf_tasks_delete ON public.taskflow_tasks;
DROP POLICY IF EXISTS tf_task_users_select ON public.taskflow_task_users;
DROP POLICY IF EXISTS tf_task_users_insert ON public.taskflow_task_users;
DROP POLICY IF EXISTS tf_task_users_delete ON public.taskflow_task_users;
DROP POLICY IF EXISTS tf_comments_select ON public.taskflow_comments;
DROP POLICY IF EXISTS tf_comments_insert ON public.taskflow_comments;
DROP POLICY IF EXISTS tf_comments_delete ON public.taskflow_comments;
DROP POLICY IF EXISTS tf_attachments_select ON public.taskflow_attachments;
DROP POLICY IF EXISTS tf_attachments_insert ON public.taskflow_attachments;
DROP POLICY IF EXISTS tf_attachments_delete ON public.taskflow_attachments;
DROP POLICY IF EXISTS tf_activity_select ON public.taskflow_activity_log;
DROP POLICY IF EXISTS tf_activity_insert ON public.taskflow_activity_log;
DROP POLICY IF EXISTS calendar_select ON public.taskflow_calendar;
DROP POLICY IF EXISTS calendar_insert ON public.taskflow_calendar;
DROP POLICY IF EXISTS calendar_delete ON public.taskflow_calendar;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;

CREATE POLICY tf_boards_select ON public.taskflow_boards
FOR SELECT USING (created_by = auth.uid());

CREATE POLICY tf_boards_insert ON public.taskflow_boards
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY tf_boards_update ON public.taskflow_boards
FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY tf_boards_delete ON public.taskflow_boards
FOR DELETE USING (created_by = auth.uid());

CREATE POLICY tf_columns_select ON public.taskflow_columns
FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.taskflow_boards b WHERE b.id = board_id AND b.created_by = auth.uid())
);

CREATE POLICY tf_columns_insert ON public.taskflow_columns
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.taskflow_boards b WHERE b.id = board_id AND b.created_by = auth.uid())
);

CREATE POLICY tf_columns_update ON public.taskflow_columns
FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.taskflow_boards b WHERE b.id = board_id AND b.created_by = auth.uid())
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.taskflow_boards b WHERE b.id = board_id AND b.created_by = auth.uid())
);

CREATE POLICY tf_columns_delete ON public.taskflow_columns
FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.taskflow_boards b WHERE b.id = board_id AND b.created_by = auth.uid())
);

CREATE POLICY tf_tasks_select ON public.taskflow_tasks
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = id AND tu.user_id = auth.uid())
);

CREATE POLICY tf_tasks_insert ON public.taskflow_tasks
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY tf_tasks_update ON public.taskflow_tasks
FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = id AND tu.user_id = auth.uid())
) WITH CHECK (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = id AND tu.user_id = auth.uid())
);

CREATE POLICY tf_tasks_delete ON public.taskflow_tasks
FOR DELETE USING (created_by = auth.uid());

CREATE POLICY tf_task_users_select ON public.taskflow_task_users
FOR SELECT USING (
  EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_task_users_insert ON public.taskflow_task_users
FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY tf_task_users_delete ON public.taskflow_task_users
FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY tf_comments_select ON public.taskflow_comments
FOR SELECT USING (
  EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_comments_insert ON public.taskflow_comments
FOR INSERT WITH CHECK (
  EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_comments_delete ON public.taskflow_comments
FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY tf_attachments_select ON public.taskflow_attachments
FOR SELECT USING (
  EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_attachments_insert ON public.taskflow_attachments
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_attachments_delete ON public.taskflow_attachments
FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY tf_activity_select ON public.taskflow_activity_log
FOR SELECT USING (
  EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY tf_activity_insert ON public.taskflow_activity_log
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())
      )
  )
);

CREATE POLICY calendar_select ON public.taskflow_calendar
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = task_id AND tu.user_id = auth.uid())
);

CREATE POLICY calendar_insert ON public.taskflow_calendar
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY calendar_delete ON public.taskflow_calendar
FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY notifications_select ON public.notifications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tf_tasks_set_updated_at ON public.taskflow_tasks;
CREATE TRIGGER tf_tasks_set_updated_at
BEFORE UPDATE ON public.taskflow_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_title text;
BEGIN
  SELECT title INTO v_task_title FROM public.taskflow_tasks WHERE id = NEW.task_id;

  INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
  VALUES (
    NEW.user_id,
    'Nova Tarefa Atribuída',
    'Você foi designado para a tarefa: ' || COALESCE(v_task_title, 'tarefa'),
    '/app/comunidade/taskflow',
    'task_assigned',
    false
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_title text;
  v_task_owner uuid;
  v_commenter_name text;
BEGIN
  SELECT title, created_by INTO v_task_title, v_task_owner
  FROM public.taskflow_tasks
  WHERE id = NEW.task_id;

  SELECT nome INTO v_commenter_name FROM public.profiles WHERE id = NEW.user_id;

  IF v_task_owner IS NOT NULL AND v_task_owner != NEW.user_id THEN
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    VALUES (
      v_task_owner,
      'Novo Comentário',
      COALESCE(v_commenter_name, 'Alguém') || ' comentou na tarefa: ' || COALESCE(v_task_title, 'tarefa'),
      '/app/comunidade/taskflow',
      'task_comment',
      false
    );
  END IF;

  INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
  SELECT
    tu.user_id,
    'Novo Comentário',
    COALESCE(v_commenter_name, 'Alguém') || ' comentou na tarefa: ' || COALESCE(v_task_title, 'tarefa'),
    '/app/comunidade/taskflow',
    'task_comment',
    false
  FROM public.taskflow_task_users tu
  WHERE tu.task_id = NEW.task_id
    AND tu.user_id != NEW.user_id
    AND (v_task_owner IS NULL OR tu.user_id != v_task_owner);

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_assignment_notify
AFTER INSERT ON public.taskflow_task_users
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

CREATE TRIGGER task_comment_notify
AFTER INSERT ON public.taskflow_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();

COMMIT;

