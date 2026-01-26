-- Function to get task details securely, bypassing RLS on columns if needed
-- This ensures that shared users can always see the column name even if they don't own the board
CREATE OR REPLACE FUNCTION public.tf_get_task_details(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, temp
AS $$
DECLARE
    v_task_data jsonb;
    v_user_id uuid := auth.uid();
BEGIN
    -- Check if user has access to the task
    -- We reuse the existing logic or check directly
    IF NOT EXISTS (
        SELECT 1 FROM public.taskflow_tasks t
        WHERE t.id = p_task_id
        AND (
            t.created_by = v_user_id
            OR EXISTS (
                SELECT 1 FROM public.taskflow_task_users tu
                WHERE tu.task_id = t.id AND tu.user_id = v_user_id
            )
        )
    ) THEN
        RETURN NULL;
    END IF;

    -- Fetch the task with all details
    SELECT to_jsonb(t_final) INTO v_task_data
    FROM (
        SELECT 
            t.*,
            -- Explicitly fetch column name bypassing RLS (since this func is SECURITY DEFINER)
            (SELECT name FROM public.taskflow_columns c WHERE c.id = t.column_id) as original_column_name,
            (
                SELECT jsonb_build_object('id', p.id, 'nome', p.nome, 'avatar_url', p.avatar_url)
                FROM public.profiles p
                WHERE p.id = t.created_by
            ) as owner,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'user_id', tu.user_id,
                        'profiles', (
                            SELECT jsonb_build_object('id', p.id, 'nome', p.nome, 'avatar_url', p.avatar_url)
                            FROM public.profiles p
                            WHERE p.id = tu.user_id
                        )
                    )
                )
                FROM public.taskflow_task_users tu
                WHERE tu.task_id = t.id
            ) as assignees
        FROM public.taskflow_tasks t
        WHERE t.id = p_task_id
    ) t_final;

    RETURN v_task_data;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.tf_get_task_details(uuid) TO authenticated;
