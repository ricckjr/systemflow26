-- FIX: PERMISSÕES RLS PARA CRM_OPORTUNIDADES
-- Execute este script no SQL Editor do Supabase para corrigir o erro de dados zerados.

-- 1. Habilitar RLS (Segurança)
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas que podem estar bloqueando acesso
DROP POLICY IF EXISTS "crm_oportunidades_select" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "crm_oportunidades_insert" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "crm_oportunidades_update" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "crm_oportunidades_delete" ON public.crm_oportunidades;

-- 3. CRIAR NOVA POLÍTICA DE LEITURA (CRUCIAL PARA OS GRÁFICOS)
-- Permite que qualquer usuário logado veja os dados
CREATE POLICY "crm_oportunidades_select"
ON public.crm_oportunidades
FOR SELECT
TO authenticated
USING (true);

-- 4. Criar outras políticas (opcional, para edição)
CREATE POLICY "crm_oportunidades_insert"
ON public.crm_oportunidades
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "crm_oportunidades_update"
ON public.crm_oportunidades
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "crm_oportunidades_delete"
ON public.crm_oportunidades
FOR DELETE
TO authenticated
USING (true);
