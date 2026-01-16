BEGIN;

ALTER TABLE public.taskflow_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tf_tasks_delete ON public.taskflow_tasks;
DROP POLICY IF EXISTS "Only creators can delete tasks" ON public.taskflow_tasks;

CREATE POLICY tf_tasks_delete ON public.taskflow_tasks
FOR DELETE USING (created_by = auth.uid());

COMMIT;

