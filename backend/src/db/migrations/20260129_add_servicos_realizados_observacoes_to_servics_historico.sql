ALTER TABLE servics_historico
ADD COLUMN IF NOT EXISTS servicos_realizados TEXT;

ALTER TABLE servics_historico
ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.servics_historico.servicos_realizados IS 'Resumo dos serviços realizados durante a movimentação (log de execução)';
COMMENT ON COLUMN public.servics_historico.observacoes IS 'Observações adicionais da movimentação (opcional)';
