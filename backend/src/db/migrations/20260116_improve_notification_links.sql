BEGIN;

-- 1. Melhorar Trigger de Notificação de Atribuição
-- Agora inclui o ID do board e da tarefa na URL para deep linking

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_title text;
  v_board_id uuid;
  v_assigner_name text;
BEGIN
  -- Busca dados da tarefa e do board
  SELECT title, board_id INTO v_task_title, v_board_id
  FROM public.taskflow_tasks 
  WHERE id = NEW.task_id;

  -- Busca nome de quem está atribuindo
  SELECT nome INTO v_assigner_name
  FROM public.profiles
  WHERE id = auth.uid();

  IF NEW.user_id != auth.uid() THEN
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    VALUES (
      NEW.user_id,
      'Nova Tarefa Atribuída',
      COALESCE(v_assigner_name, 'Alguém') || ' atribuiu a tarefa "' || COALESCE(v_task_title, 'Sem título') || '" a você.',
      '/app/comunidade/taskflow?boardId=' || v_board_id || '&taskId=' || NEW.task_id,
      'task_assigned',
      false
    );
  END IF;

  RETURN NEW;
END;
$$;


-- 2. Melhorar Trigger de Notificação de Comentários
-- Também inclui deep link para abrir direto a tarefa

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_title text;
  v_board_id uuid;
  v_task_owner uuid;
  v_commenter_name text;
BEGIN
  -- Busca dados da tarefa
  SELECT title, board_id, created_by INTO v_task_title, v_board_id, v_task_owner
  FROM public.taskflow_tasks
  WHERE id = NEW.task_id;

  -- Busca nome do autor do comentário
  SELECT nome INTO v_commenter_name FROM public.profiles WHERE id = NEW.user_id;

  -- Notifica o Dono da Tarefa (se não for ele mesmo quem comentou)
  IF v_task_owner IS NOT NULL AND v_task_owner != NEW.user_id THEN
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    VALUES (
      v_task_owner,
      'Novo Comentário',
      COALESCE(v_commenter_name, 'Alguém') || ' comentou na tarefa: ' || COALESCE(v_task_title, 'tarefa'),
      '/app/comunidade/taskflow?boardId=' || v_board_id || '&taskId=' || NEW.task_id,
      'task_comment',
      false
    );
  END IF;

  -- Notifica outros participantes (Assignees)
  INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
  SELECT
    tu.user_id,
    'Novo Comentário',
    COALESCE(v_commenter_name, 'Alguém') || ' comentou na tarefa: ' || COALESCE(v_task_title, 'tarefa'),
    '/app/comunidade/taskflow?boardId=' || v_board_id || '&taskId=' || NEW.task_id,
    'task_comment',
    false
  FROM public.taskflow_task_users tu
  WHERE tu.task_id = NEW.task_id
    AND tu.user_id != NEW.user_id -- Não notifica quem comentou
    AND (v_task_owner IS NULL OR tu.user_id != v_task_owner); -- Não notifica o dono de novo

  RETURN NEW;
END;
$$;

COMMIT;
