CREATE OR REPLACE FUNCTION public.tf_move_task_to_column_name(p_task_id uuid, p_to_column_name text)
RETURNS public.taskflow_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_task public.taskflow_tasks;
  v_to_column_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.tf_has_task_access(p_task_id) THEN
    RAISE EXCEPTION 'no_task_access';
  END IF;

  SELECT * INTO v_task
  FROM public.taskflow_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  SELECT c.id INTO v_to_column_id
  FROM public.taskflow_columns c
  WHERE c.board_id = v_task.board_id
    AND upper(trim(c.name)) = upper(trim(p_to_column_name))
  ORDER BY c.order_index
  LIMIT 1;

  IF v_to_column_id IS NULL THEN
    RAISE EXCEPTION 'column_not_found_for_board';
  END IF;

  UPDATE public.taskflow_tasks
  SET column_id = v_to_column_id,
      updated_at = now()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tf_move_task_to_column_name(uuid, text) TO authenticated;
