BEGIN;

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

ALTER TABLE public.taskflow_task_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tf_task_users_select ON public.taskflow_task_users;
DROP POLICY IF EXISTS tf_task_users_insert ON public.taskflow_task_users;
DROP POLICY IF EXISTS tf_task_users_delete ON public.taskflow_task_users;
DROP POLICY IF EXISTS "View assignments" ON public.taskflow_task_users;
DROP POLICY IF EXISTS "Manage assignments" ON public.taskflow_task_users;

CREATE POLICY tf_task_users_select ON public.taskflow_task_users
FOR SELECT USING (
  user_id = auth.uid()
  OR public.tf_is_task_owner(task_id)
);

CREATE POLICY tf_task_users_insert ON public.taskflow_task_users
FOR INSERT WITH CHECK (
  public.tf_is_task_owner(task_id)
);

CREATE POLICY tf_task_users_delete ON public.taskflow_task_users
FOR DELETE USING (
  user_id = auth.uid()
  OR public.tf_is_task_owner(task_id)
);

COMMIT;
