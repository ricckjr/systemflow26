BEGIN;

-- ==============================================================================
-- FIX TASKFLOW RLS FOR NEW USERS
-- ==============================================================================

-- 1. DROP EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_boards_insert ON public.taskflow_boards;
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
DROP POLICY IF EXISTS tf_columns_insert ON public.taskflow_columns;

-- 2. SIMPLIFIED BOARD ACCESS FUNCTION
-- Avoids complex joins inside the function if possible, but keep the logic sound.
CREATE OR REPLACE FUNCTION public.tf_has_board_access(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Direct ownership check (most common case for new users)
  IF EXISTS (
    SELECT 1 FROM public.taskflow_boards 
    WHERE id = p_board_id AND created_by = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Shared access check (via tasks)
  RETURN EXISTS (
    SELECT 1 FROM public.taskflow_tasks t
    JOIN public.taskflow_task_users tu ON t.id = tu.task_id
    WHERE t.board_id = p_board_id 
    AND tu.user_id = auth.uid()
  );
END;
$$;

-- 3. RE-APPLY BOARD POLICIES
CREATE POLICY tf_boards_select ON public.taskflow_boards
FOR SELECT USING (
  created_by = auth.uid() OR public.tf_has_board_access(id)
);

CREATE POLICY tf_boards_insert ON public.taskflow_boards
FOR INSERT WITH CHECK (created_by = auth.uid());

-- 4. RE-APPLY COLUMN POLICIES
CREATE POLICY tf_columns_select ON public.taskflow_columns
FOR SELECT USING (
  public.tf_has_board_access(board_id)
);

CREATE POLICY tf_columns_insert ON public.taskflow_columns
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.taskflow_boards 
    WHERE id = board_id AND created_by = auth.uid()
  )
);

COMMIT;
