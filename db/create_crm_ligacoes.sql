-- Tabela para rastrear Ligações (KPI: Ligações Feitas)
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.crm_ligacoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    id_oportunidade text, -- Pode ser null se for uma ligação fria (cold call)
    vendedor text,        -- Nome ou ID do vendedor
    cliente text,         -- Nome do cliente contatado
    telefone text,        -- Número discado
    duracao integer,      -- Duração em segundos
    resultado text,       -- Ex: 'Atendido', 'Caixa Postal', 'Agendado'
    notas text,
    data_hora timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_ligacoes_data ON public.crm_ligacoes(data_hora);
CREATE INDEX IF NOT EXISTS idx_crm_ligacoes_vendedor ON public.crm_ligacoes(vendedor);

-- RLS (Segurança)
ALTER TABLE public.crm_ligacoes ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (Permitir frontend ler para KPIs)
CREATE POLICY "crm_ligacoes_select"
ON public.crm_ligacoes
FOR SELECT
TO authenticated
USING (true);

-- Política de Inserção (Permitir vendedores registrarem)
CREATE POLICY "crm_ligacoes_insert"
ON public.crm_ligacoes
FOR INSERT
TO authenticated
WITH CHECK (true);
