-- PERMISSÕES DE LEITURA PARA O DASHBOARD (TV / VISÃO GERAL)
-- Este script garante que TODOS os usuários logados possam ler os dados para montar os gráficos.

-- 1. Tabela: crm_oportunidades
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

-- Remove política antiga se existir (para evitar duplicidade/conflitos)
DROP POLICY IF EXISTS "Permitir leitura para todos usuarios autenticados" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "crm_oportunidades_select_all" ON public.crm_oportunidades;

-- Cria nova política: Qualquer usuário autenticado pode ver TODAS as oportunidades
CREATE POLICY "crm_oportunidades_select_all"
ON public.crm_oportunidades
FOR SELECT
TO authenticated
USING (true);


-- 2. Tabela: crm_ligacoes
ALTER TABLE public.crm_ligacoes ENABLE ROW LEVEL SECURITY;

-- Remove política antiga se existir
DROP POLICY IF EXISTS "crm_ligacoes_select" ON public.crm_ligacoes;
DROP POLICY IF EXISTS "crm_ligacoes_read_all" ON public.crm_ligacoes;

-- Cria nova política: Qualquer usuário autenticado pode ver TODAS as ligações
CREATE POLICY "crm_ligacoes_read_all"
ON public.crm_ligacoes
FOR SELECT
TO authenticated
USING (true);


-- 3. (Opcional) Se houver tabela de vendedores/users separada que precise ser lida
-- Normalmente o nome do vendedor já está na tabela de oportunidades, então ok.
