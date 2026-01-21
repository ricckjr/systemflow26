-- Tabela para histórico de movimentação dos serviços (Log de Auditoria e Rastreabilidade)
-- Registra cada transição de fase e troca de responsável, permitindo análise de SLA e gargalos.

CREATE TABLE IF NOT EXISTS public.servics_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo com o serviço
  service_id uuid NOT NULL REFERENCES public.servics_equipamento(id) ON DELETE CASCADE,
  
  -- Dados de Origem (De onde veio)
  fase_origem text,
  responsavel_origem text,
  
  -- Dados de Destino (Para onde foi / Quem recebeu)
  fase_destino text NOT NULL,
  responsavel_destino text, -- "Nome pra quem foi o serviço"
  
  -- Metadados da Transição
  alterado_por uuid REFERENCES public.profiles(id), -- Quem executou a ação (Log de Auditoria)
  data_movimentacao timestamptz DEFAULT now(), -- "Hora que passou/recebeu" (Registro do evento)
  
  -- SLA: Opcional, para futuro cálculo de tempo de permanência na fase anterior
  tempo_permanencia interval 
);

-- Índices para performance em consultas de histórico e relatórios
CREATE INDEX IF NOT EXISTS idx_servics_historico_service_id ON public.servics_historico(service_id);
CREATE INDEX IF NOT EXISTS idx_servics_historico_data_movimentacao ON public.servics_historico(data_movimentacao);

-- RLS (Row Level Security)
ALTER TABLE public.servics_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura permitida para autenticados"
ON public.servics_historico
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Inserção permitida para autenticados"
ON public.servics_historico
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Comentários para documentação do banco
COMMENT ON TABLE public.servics_historico IS 'Histórico detalhado de movimentação de serviços (Fases e Responsáveis)';
COMMENT ON COLUMN public.servics_historico.responsavel_destino IS 'Nome do responsável que recebeu o serviço nesta etapa';
COMMENT ON COLUMN public.servics_historico.data_movimentacao IS 'Data e hora exata da transferência de responsabilidade/fase';
