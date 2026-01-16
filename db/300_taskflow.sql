-- TaskFlow (Kanban) schema
-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Boards
CREATE TABLE IF NOT EXISTS public.taskflow_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Columns
CREATE TABLE IF NOT EXISTS public.taskflow_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.taskflow_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. Tasks
CREATE TABLE IF NOT EXISTS public.taskflow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.taskflow_boards(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.taskflow_columns(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Task Users (Assignments)
CREATE TABLE IF NOT EXISTS public.taskflow_task_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('assignee','viewer')) DEFAULT 'assignee',
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id, role)
);

-- 5. Comments
CREATE TABLE IF NOT EXISTS public.taskflow_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. Attachments (New)
CREATE TABLE IF NOT EXISTS public.taskflow_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 7. Activity Log
CREATE TABLE IF NOT EXISTS public.taskflow_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS tf_columns_board_idx ON public.taskflow_columns(board_id, order_index);
CREATE INDEX IF NOT EXISTS tf_tasks_board_col_idx ON public.taskflow_tasks(board_id, column_id);
CREATE INDEX IF NOT EXISTS tf_task_users_task_idx ON public.taskflow_task_users(task_id);
CREATE INDEX IF NOT EXISTS tf_comments_task_idx ON public.taskflow_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS tf_attachments_task_idx ON public.taskflow_attachments(task_id);
CREATE INDEX IF NOT EXISTS tf_activity_task_idx ON public.taskflow_activity_log(task_id, created_at);

-- RLS
ALTER TABLE public.taskflow_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_task_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_insert ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_insert ON public.taskflow_columns;
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

-- Boards Policies
CREATE OR REPLACE FUNCTION public.tf_is_board_owner(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.taskflow_boards b
    WHERE b.id = p_board_id
      AND b.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.tf_can_access_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.tf_is_board_owner(p_board_id)
    OR EXISTS(
      SELECT 1
      FROM public.taskflow_tasks t
      JOIN public.taskflow_task_users tu ON tu.task_id = t.id
      WHERE t.board_id = p_board_id
        AND tu.user_id = auth.uid()
    );
$$;

CREATE POLICY tf_boards_select ON public.taskflow_boards FOR SELECT USING (public.tf_can_access_board(id));
CREATE POLICY tf_boards_insert ON public.taskflow_boards FOR INSERT WITH CHECK (created_by = auth.uid());

-- Columns Policies
CREATE POLICY tf_columns_select ON public.taskflow_columns FOR SELECT USING (
  public.tf_can_access_board(board_id)
);
CREATE POLICY tf_columns_insert ON public.taskflow_columns FOR INSERT WITH CHECK (
  public.tf_is_board_owner(board_id)
);

-- Tasks Policies
CREATE POLICY tf_tasks_select ON public.taskflow_tasks FOR SELECT USING (
  public.tf_can_access_task(id)
);
CREATE POLICY tf_tasks_insert ON public.taskflow_tasks FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY tf_tasks_update ON public.taskflow_tasks FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = id AND tu.user_id = auth.uid())
) WITH CHECK (
  created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = id AND tu.user_id = auth.uid())
);
CREATE POLICY tf_tasks_delete ON public.taskflow_tasks FOR DELETE USING (
  created_by = auth.uid()
);

-- Task Users Policies
CREATE OR REPLACE FUNCTION public.tf_is_task_owner(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.taskflow_tasks t
    WHERE t.id = p_task_id
      AND t.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.tf_can_access_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS(
      SELECT 1
      FROM public.taskflow_tasks t
      WHERE t.id = p_task_id
        AND t.created_by = auth.uid()
    )
    OR EXISTS(
      SELECT 1
      FROM public.taskflow_task_users tu
      WHERE tu.task_id = p_task_id
        AND tu.user_id = auth.uid()
    );
$$;

CREATE POLICY tf_task_users_select ON public.taskflow_task_users FOR SELECT USING (
  public.tf_can_access_task(task_id)
);
CREATE POLICY tf_task_users_insert ON public.taskflow_task_users FOR INSERT WITH CHECK (
  public.tf_is_task_owner(task_id)
);
CREATE POLICY tf_task_users_delete ON public.taskflow_task_users FOR DELETE USING (
  user_id = auth.uid()
  OR public.tf_is_task_owner(task_id)
);

-- Comments Policies
CREATE POLICY tf_comments_select ON public.taskflow_comments FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);
CREATE POLICY tf_comments_insert ON public.taskflow_comments FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);
CREATE POLICY tf_comments_delete ON public.taskflow_comments FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

-- Attachments Policies
CREATE POLICY tf_attachments_select ON public.taskflow_attachments FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);
CREATE POLICY tf_attachments_insert ON public.taskflow_attachments FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);
CREATE POLICY tf_attachments_delete ON public.taskflow_attachments FOR DELETE USING (
  created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

-- Activity Log Policies
CREATE POLICY tf_activity_select ON public.taskflow_activity_log FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);
CREATE POLICY tf_activity_insert ON public.taskflow_activity_log FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND (t.created_by = auth.uid() OR EXISTS(SELECT 1 FROM public.taskflow_task_users x WHERE x.task_id = t.id AND x.user_id = auth.uid())))
);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tf_tasks_set_updated_at ON public.taskflow_tasks;
CREATE TRIGGER tf_tasks_set_updated_at BEFORE UPDATE ON public.taskflow_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
