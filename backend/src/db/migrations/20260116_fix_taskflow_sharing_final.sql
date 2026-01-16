BEGIN;

-- ==============================================================================
-- 1. GARANTIR VISIBILIDADE DE PERFIS (PROFILES)
-- ==============================================================================
-- Para compartilhar, o usuário precisa ver a lista de outros usuários.
-- Garante que perfis ativos sejam visíveis para todos os usuários autenticados.

DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
CREATE POLICY profiles_read_all ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');


-- ==============================================================================
-- 2. CORRIGIR VISIBILIDADE DO BOARD E COLUNAS (RLS)
-- ==============================================================================
-- O usuário precisa ver o Board e as Colunas para ver a Tarefa.

-- Função auxiliar otimizada para verificar acesso ao board
CREATE OR REPLACE FUNCTION public.tf_has_board_access(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- É dono do board OU tem alguma tarefa atribuída neste board
  RETURN EXISTS (
    SELECT 1 FROM public.taskflow_boards b
    WHERE b.id = p_board_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.taskflow_tasks t
        JOIN public.taskflow_task_users tu ON t.id = tu.task_id
        WHERE t.board_id = b.id AND tu.user_id = auth.uid()
      )
    )
  );
END;
$$;

-- Atualizar RLS de Boards
ALTER TABLE public.taskflow_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
CREATE POLICY tf_boards_select ON public.taskflow_boards
FOR SELECT USING (public.tf_has_board_access(id));

-- Atualizar RLS de Colunas
ALTER TABLE public.taskflow_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
CREATE POLICY tf_columns_select ON public.taskflow_columns
FOR SELECT USING (public.tf_has_board_access(board_id));


-- ==============================================================================
-- 3. CORRIGIR VISIBILIDADE DAS TAREFAS E ATRIBUIÇÕES
-- ==============================================================================

-- Função auxiliar para verificar acesso à tarefa
CREATE OR REPLACE FUNCTION public.tf_has_task_access(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- É dono da tarefa OU está atribuído a ela
  RETURN EXISTS (
    SELECT 1 FROM public.taskflow_tasks t
    WHERE t.id = p_task_id
    AND (
      t.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.taskflow_task_users tu 
        WHERE tu.task_id = t.id AND tu.user_id = auth.uid()
      )
    )
  );
END;
$$;

-- RLS Tarefas
ALTER TABLE public.taskflow_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_tasks_select ON public.taskflow_tasks;
CREATE POLICY tf_tasks_select ON public.taskflow_tasks
FOR SELECT USING (public.tf_has_task_access(id));

-- RLS Atribuições (Quem é responsável)
-- Todos com acesso à tarefa podem ver quem mais é responsável
ALTER TABLE public.taskflow_task_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tf_task_users_select ON public.taskflow_task_users;
CREATE POLICY tf_task_users_select ON public.taskflow_task_users
FOR SELECT USING (public.tf_has_task_access(task_id));

-- Permitir que o dono da tarefa adicione/remova outros usuários
DROP POLICY IF EXISTS tf_task_users_insert ON public.taskflow_task_users;
CREATE POLICY tf_task_users_insert ON public.taskflow_task_users
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);

DROP POLICY IF EXISTS tf_task_users_delete ON public.taskflow_task_users;
CREATE POLICY tf_task_users_delete ON public.taskflow_task_users
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.taskflow_tasks t WHERE t.id = task_id AND t.created_by = auth.uid())
);


-- ==============================================================================
-- 4. CORRIGIR NOTIFICAÇÕES (TRIGGER)
-- ==============================================================================

-- Garantir que a tabela de notificações permita inserção pelo Trigger (Security Definer resolve, mas reforçando)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recriar a função de notificação com lógica robusta
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como superusuário para ignorar RLS no INSERT de notificações para outros
AS $$
DECLARE
  v_task_title text;
  v_assigner_name text;
  v_task_owner uuid;
BEGIN
  -- Busca dados da tarefa
  SELECT title, created_by INTO v_task_title, v_task_owner
  FROM public.taskflow_tasks 
  WHERE id = NEW.task_id;

  -- Busca nome de quem está atribuindo (o usuário logado atual)
  SELECT nome INTO v_assigner_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Evita notificar a si mesmo (embora o frontend já filtre, é bom garantir)
  IF NEW.user_id != auth.uid() THEN
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    VALUES (
      NEW.user_id,
      'Nova Tarefa Atribuída',
      COALESCE(v_assigner_name, 'Alguém') || ' atribuiu a tarefa "' || COALESCE(v_task_title, 'Sem título') || '" a você.',
      '/app/comunidade/taskflow',
      'task_assigned',
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar o Trigger
DROP TRIGGER IF EXISTS task_assignment_notify ON public.taskflow_task_users;
CREATE TRIGGER task_assignment_notify
AFTER INSERT ON public.taskflow_task_users
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

COMMIT;
