-- ==============================================================================
-- 🚀 PERFORMANCE PACK v2.0
-- Data: 2026-01-16
-- Descrição: Views Materializadas (ou Views), Funções Auxiliares e Índices
-- Objetivo: Reduzir carga no Frontend e acelerar queries
-- ==============================================================================

-- 1. Função Auxiliar para Parse de Moeda (PT-BR e Geral)
CREATE OR REPLACE FUNCTION public.parse_currency_br(value text)
RETURNS numeric AS $$
DECLARE
    clean_val text;
BEGIN
    IF value IS NULL OR value = '' THEN
        RETURN 0;
    END IF;
    
    -- Remove tudo que não é número, ponto ou vírgula
    clean_val := regexp_replace(value, '[^0-9,.]', '', 'g');
    
    -- Se tiver vírgula e ponto (ex: 1.000,00)
    IF strpos(clean_val, ',') > 0 AND strpos(clean_val, '.') > 0 THEN
        IF strpos(clean_val, ',') > strpos(clean_val, '.') THEN
             -- Formato BR (1.000,00) -> remove ponto, troca virgula por ponto
             clean_val := replace(clean_val, '.', '');
             clean_val := replace(clean_val, ',', '.');
        ELSE
             -- Formato US (1,000.00) -> remove virgula
             clean_val := replace(clean_val, ',', '');
        END IF;
    ELSIF strpos(clean_val, ',') > 0 THEN
        -- Apenas vírgula (100,00) -> troca por ponto
        clean_val := replace(clean_val, ',', '.');
    END IF;
    
    RETURN CAST(clean_val AS numeric);
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. View de KPIs do CRM (Agregada)
-- Substitui a necessidade de baixar 10k linhas para somar no JS
CREATE OR REPLACE VIEW public.view_crm_kpis AS
SELECT
    date_trunc('month', COALESCE(to_date(data, 'YYYY-MM-DD'), to_date(data_inclusao, 'YYYY-MM-DD'), now()))::date as mes_referencia,
    vendedor,
    status,
    etapa,
    COUNT(*) as total_count,
    SUM(public.parse_currency_br(valor_proposta)) as total_valor
FROM
    public.crm_oportunidades
GROUP BY
    1, 2, 3, 4;

-- Permissões para a View
GRANT SELECT ON public.view_crm_kpis TO authenticated;


-- 3. View de Resumo do TaskFlow (Kanban Headers)
CREATE OR REPLACE VIEW public.view_taskflow_summary AS
SELECT
    board_id,
    column_id,
    COUNT(*) as total_tasks
FROM
    public.taskflow_tasks
GROUP BY
    1, 2;

GRANT SELECT ON public.view_taskflow_summary TO authenticated;


-- 4. Índices Estratégicos (B-Tree para igualdade e Range)

-- CRM
CREATE INDEX IF NOT EXISTS idx_crm_ops_vendedor ON public.crm_oportunidades(vendedor);
CREATE INDEX IF NOT EXISTS idx_crm_ops_status ON public.crm_oportunidades(status);
CREATE INDEX IF NOT EXISTS idx_crm_ops_etapa ON public.crm_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_ops_data_inclusao ON public.crm_oportunidades(data_inclusao);

-- TaskFlow
CREATE INDEX IF NOT EXISTS idx_tf_tasks_board ON public.taskflow_tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tf_tasks_column ON public.taskflow_tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tf_tasks_created_by ON public.taskflow_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tf_tasks_assignees ON public.taskflow_task_users(user_id);

-- Profiles (Busca por nome/email)
CREATE INDEX IF NOT EXISTS idx_profiles_email_login ON public.profiles(email_login);
CREATE INDEX IF NOT EXISTS idx_profiles_nome ON public.profiles(nome);

COMMENT ON VIEW public.view_crm_kpis IS 'Agregação mensal de oportunidades para Dashboard';
