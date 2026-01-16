BEGIN;

-- 1. Remover colunas duplicadas (mantendo a mais antiga)
DELETE FROM public.taskflow_columns
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY board_id, name ORDER BY created_at ASC) as rnum
    FROM public.taskflow_columns
  ) t
  WHERE t.rnum > 1
);

-- 2. Adicionar restrição única para evitar duplicatas futuras
-- Verifica se a constraint já existe antes de tentar criar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tf_columns_board_name_key') THEN
    ALTER TABLE public.taskflow_columns
    ADD CONSTRAINT tf_columns_board_name_key UNIQUE (board_id, name);
  END IF;
END $$;

-- 3. Melhorar as Políticas de Segurança (RLS) para permitir Compartilhamento

-- Função auxiliar para verificar acesso ao board
-- Um usuário pode ver um board se:
-- a) Ele criou o board
-- b) Ele tem uma tarefa atribuída (como assignee ou viewer) dentro desse board
CREATE OR REPLACE FUNCTION public.tf_can_access_board(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Atualizar Política de Leitura dos Boards
DROP POLICY IF EXISTS tf_boards_select ON public.taskflow_boards;
CREATE POLICY tf_boards_select ON public.taskflow_boards
FOR SELECT USING (public.tf_can_access_board(id));

-- Atualizar Política de Leitura das Colunas
-- Agora as colunas são visíveis se o usuário tiver acesso ao board (seja dono ou colaborador)
DROP POLICY IF EXISTS tf_columns_select ON public.taskflow_columns;
CREATE POLICY tf_columns_select ON public.taskflow_columns
FOR SELECT USING (public.tf_can_access_board(board_id));

COMMIT;
