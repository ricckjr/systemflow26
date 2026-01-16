BEGIN;

-- Função para notificar mudança de status baseada no Log de Atividade
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_title text;
  v_board_id uuid;
  v_task_owner uuid;
  v_changer_name text;
  v_new_status text;
BEGIN
  -- Apenas processar se o tipo for 'status_changed'
  IF NEW.type = 'status_changed' THEN
    
    -- Busca dados da tarefa
    SELECT title, board_id, created_by INTO v_task_title, v_board_id, v_task_owner
    FROM public.taskflow_tasks 
    WHERE id = NEW.task_id;

    -- Busca nome de quem fez a alteração
    SELECT nome INTO v_changer_name 
    FROM public.profiles 
    WHERE id = NEW.user_id;

    -- O novo status está no campo 'details' do log (ex: "EM ANÁLISE")
    v_new_status := NEW.details;

    -- 1. Notificar o Dono da Tarefa (se não for ele quem mudou)
    IF v_task_owner IS NOT NULL AND v_task_owner != NEW.user_id THEN
      INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
      VALUES (
        v_task_owner,
        'Tarefa Movida',
        COALESCE(v_changer_name, 'Alguém') || ' moveu a tarefa "' || COALESCE(v_task_title, 'Sem título') || '" para ' || COALESCE(v_new_status, 'nova etapa') || '.',
        '/app/comunidade/taskflow?boardId=' || v_board_id || '&taskId=' || NEW.task_id,
        'task_status_change',
        false
      );
    END IF;

    -- 2. Notificar outros participantes (Assignees)
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    SELECT
      tu.user_id,
      'Tarefa Movida',
      COALESCE(v_changer_name, 'Alguém') || ' moveu a tarefa "' || COALESCE(v_task_title, 'Sem título') || '" para ' || COALESCE(v_new_status, 'nova etapa') || '.',
      '/app/comunidade/taskflow?boardId=' || v_board_id || '&taskId=' || NEW.task_id,
      'task_status_change',
      false
    FROM public.taskflow_task_users tu
    WHERE tu.task_id = NEW.task_id
      AND tu.user_id != NEW.user_id -- Não notifica quem mudou
      AND (v_task_owner IS NULL OR tu.user_id != v_task_owner); -- Não notifica o dono novamente

  END IF;

  RETURN NEW;
END;
$$;

-- Criar o Trigger na tabela de logs
DROP TRIGGER IF EXISTS task_status_notify ON public.taskflow_activity_log;
CREATE TRIGGER task_status_notify
AFTER INSERT ON public.taskflow_activity_log
FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_change();

COMMIT;
