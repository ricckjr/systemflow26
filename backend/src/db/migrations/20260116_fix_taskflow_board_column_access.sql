BEGIN;

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

ALTER TABLE public.taskflow_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taskflow_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_insert ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_insert ON public.taskflow_columns;

CREATE POLICY tf_boards_select ON public.taskflow_boards
FOR SELECT USING (public.tf_can_access_board(id));

CREATE POLICY tf_boards_insert ON public.taskflow_boards
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY tf_columns_select ON public.taskflow_columns
FOR SELECT USING (public.tf_can_access_board(board_id));

CREATE POLICY tf_columns_insert ON public.taskflow_columns
FOR INSERT WITH CHECK (public.tf_is_board_owner(board_id));

COMMIT;

