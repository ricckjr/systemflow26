-- 1. Calendar System
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE TABLE IF NOT EXISTS public.taskflow_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.taskflow_tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Notifications System
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  link text,
  type text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.taskflow_calendar') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.taskflow_calendar IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.notifications IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF to_regclass('public.taskflow_task_users') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.taskflow_task_users IN ACCESS EXCLUSIVE MODE';
  END IF;
  IF to_regclass('public.taskflow_comments') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public.taskflow_comments IN ACCESS EXCLUSIVE MODE';
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_user ON public.taskflow_calendar(user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- RLS
ALTER TABLE public.taskflow_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_select ON public.taskflow_calendar;
DROP POLICY IF EXISTS calendar_insert ON public.taskflow_calendar;
DROP POLICY IF EXISTS calendar_delete ON public.taskflow_calendar;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;

-- Calendar Policies
CREATE POLICY calendar_select ON public.taskflow_calendar FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS(SELECT 1 FROM public.taskflow_task_users tu WHERE tu.task_id = task_id AND tu.user_id = auth.uid())
);

CREATE POLICY calendar_insert ON public.taskflow_calendar FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

CREATE POLICY calendar_delete ON public.taskflow_calendar FOR DELETE USING (
  user_id = auth.uid() OR 
  EXISTS(SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

-- Notification Policies
CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- 3. Triggers

-- Trigger: Task Assignment
CREATE OR REPLACE FUNCTION notify_task_assignment()
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

DROP TRIGGER IF EXISTS task_assignment_notify ON public.taskflow_task_users;
CREATE TRIGGER task_assignment_notify
AFTER INSERT ON public.taskflow_task_users
FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();

-- Trigger: Task Comment
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_title text;
  v_task_owner uuid;
  v_commenter_name text;
BEGIN
  SELECT title, created_by INTO v_task_title, v_task_owner FROM public.taskflow_tasks WHERE id = NEW.task_id;
  SELECT nome INTO v_commenter_name FROM public.profiles WHERE id = NEW.user_id;

  -- Notify Task Owner (if not the commenter)
  IF v_task_owner != NEW.user_id THEN
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

  -- Notify Assignees (if not the commenter and not the owner)
  INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
  SELECT
    user_id,
    'Novo Comentário',
    COALESCE(v_commenter_name, 'Alguém') || ' comentou na tarefa: ' || COALESCE(v_task_title, 'tarefa'),
    '/app/comunidade/taskflow',
    'task_comment',
    false
  FROM public.taskflow_task_users
  WHERE task_id = NEW.task_id AND user_id != NEW.user_id AND user_id != v_task_owner;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comment_notify ON public.taskflow_comments;
CREATE TRIGGER task_comment_notify
AFTER INSERT ON public.taskflow_comments
FOR EACH ROW EXECUTE FUNCTION notify_task_comment();

COMMIT;

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

-- Trigger: InstaFlow New Post
CREATE OR REPLACE FUNCTION notify_instaflow_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
  SELECT
    id,
    'Novo post no InstaFlow',
    'Confira a nova publicação na comunidade.',
    '/app/comunidade/instaflow',
    'instaflow_post',
    false
  FROM public.profiles
  WHERE id != NEW.created_by AND ativo = true;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instaflow_notify ON public.instaflow_posts;
CREATE TRIGGER instaflow_notify
AFTER INSERT ON public.instaflow_posts
FOR EACH ROW EXECUTE FUNCTION notify_instaflow_post();

COMMIT;
