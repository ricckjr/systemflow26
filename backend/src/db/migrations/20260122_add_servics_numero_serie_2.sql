ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS numero_serie2 text;

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS vendedor text;

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS email_vendedor text;

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS empresa_correspondente text;

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS relatorio_tecnico text;

ALTER TABLE public.servics_equipamento
ADD COLUMN IF NOT EXISTS anexos jsonb;
