ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS data_demissao date;

ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS obs_demissao text;
