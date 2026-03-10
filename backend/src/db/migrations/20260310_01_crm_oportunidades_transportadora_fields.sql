ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS remetente_completo text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS destinatario_completo text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS numero_nota_fiscal text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS valor_nota_fiscal numeric(14, 2);

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS material text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS quantidade_volumes integer;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS especie text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS peso numeric(14, 3);

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS medidas text;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS transportadora text;
