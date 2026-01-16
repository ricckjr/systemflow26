BEGIN;

-- 1. Políticas para Comentários (taskflow_comments)
-- Permitir leitura para usuários autenticados (simplificado para resolver o "branco")
DROP POLICY IF EXISTS "Authenticated users can select comments" ON public.taskflow_comments;
CREATE POLICY "Authenticated users can select comments"
ON public.taskflow_comments FOR SELECT
TO authenticated
USING (true);

-- Permitir inserção (já deve existir, mas reforçando)
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.taskflow_comments;
CREATE POLICY "Authenticated users can insert comments"
ON public.taskflow_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Políticas para Log de Atividade (taskflow_activity_log)
-- Permitir leitura
DROP POLICY IF EXISTS "Authenticated users can select activity log" ON public.taskflow_activity_log;
CREATE POLICY "Authenticated users can select activity log"
ON public.taskflow_activity_log FOR SELECT
TO authenticated
USING (true);

-- Permitir inserção
DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.taskflow_activity_log;
CREATE POLICY "Authenticated users can insert activity log"
ON public.taskflow_activity_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Políticas para Anexos (taskflow_attachments)
-- Permitir leitura
DROP POLICY IF EXISTS "Authenticated users can select attachments" ON public.taskflow_attachments;
CREATE POLICY "Authenticated users can select attachments"
ON public.taskflow_attachments FOR SELECT
TO authenticated
USING (true);

COMMIT;
