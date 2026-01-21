-- Adiciona colunas para Certificado e Calibração na tabela servics_equipamento

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS numero_certificado text,
ADD COLUMN IF NOT EXISTS data_calibracao timestamp with time zone;

-- Comentários para documentação
COMMENT ON COLUMN public.servics_equipamento.numero_certificado IS 'Número do certificado de calibração';
COMMENT ON COLUMN public.servics_equipamento.data_calibracao IS 'Data de realização da calibração';
