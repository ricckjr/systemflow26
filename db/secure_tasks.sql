-- Enable RLS on tasks table
ALTER TABLE taskflow_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tasks or tasks assigned to them
CREATE POLICY "Users can view own or assigned tasks" ON taskflow_tasks
FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM taskflow_task_users
    WHERE task_id = taskflow_tasks.id
    AND user_id = auth.uid()
  )
);

-- Policy: Users can update their own tasks or tasks assigned to them
CREATE POLICY "Users can update own or assigned tasks" ON taskflow_tasks
FOR UPDATE
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM taskflow_task_users
    WHERE task_id = taskflow_tasks.id
    AND user_id = auth.uid()
  )
);

-- Policy: Only creators can delete tasks
CREATE POLICY "Only creators can delete tasks" ON taskflow_tasks
FOR DELETE
USING (auth.uid() = created_by);

-- Policy: Users can insert tasks (automatically own them)
CREATE POLICY "Users can create tasks" ON taskflow_tasks
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Enable RLS on task_users (assignments)
ALTER TABLE taskflow_task_users ENABLE ROW LEVEL SECURITY;

-- Policy: View assignments if you can view the task
CREATE POLICY "View assignments" ON taskflow_task_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM taskflow_tasks
    WHERE id = taskflow_task_users.task_id
    AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM taskflow_task_users tu
        WHERE tu.task_id = taskflow_tasks.id
        AND tu.user_id = auth.uid()
      )
    )
  )
);

-- Policy: Creators can manage assignments
CREATE POLICY "Manage assignments" ON taskflow_task_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM taskflow_tasks
    WHERE id = taskflow_task_users.task_id
    AND created_by = auth.uid()
  )
);

-- Ensure notifications table exists (basic structure if not present)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  link TEXT,
  type TEXT
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT WITH CHECK (true); -- Allow inserts generally (or restrict if needed)

CREATE POLICY "Users can update own notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);
