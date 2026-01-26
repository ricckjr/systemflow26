-- Optimize TaskFlow queries

-- 1. Index for ordering tasks by creation date (used in fetchUnifiedTasks)
CREATE INDEX IF NOT EXISTS idx_taskflow_tasks_created_at ON taskflow_tasks(created_at);

-- 2. Index for filtering tasks by board (if not covered efficiently by composite)
-- We have tf_tasks_board_col_idx (board_id, column_id), which works for board_id filtering.
-- But let's ensure we have good coverage for the unified view.

-- 3. Index for task_seen (user_id, task_id) is likely implicit or primary key?
-- The table taskflow_task_seen likely has a PK on (user_id, task_id) or (task_id, user_id).
-- Let's ensure we have an index on user_id for fast retrieval of all seen tasks by user.
CREATE INDEX IF NOT EXISTS idx_taskflow_task_seen_user_id ON taskflow_task_seen(user_id);

-- 4. Analyze tables to update stats
ANALYZE taskflow_tasks;
ANALYZE taskflow_task_seen;
