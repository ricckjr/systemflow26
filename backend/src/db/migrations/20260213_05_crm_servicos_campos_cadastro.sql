BEGIN;

ALTER TABLE public.crm_servicos
  ADD COLUMN IF NOT EXISTS categ_serv TEXT;

ALTER TABLE public.crm_servicos
  ADD COLUMN IF NOT EXISTS cod_lc116 TEXT;

ALTER TABLE public.crm_servicos
  ADD COLUMN IF NOT EXISTS cod_nbs TEXT;

ALTER TABLE public.crm_servicos
  ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT;

ALTER TABLE public.crm_servicos
  ADD COLUMN IF NOT EXISTS valor_serv NUMERIC(15, 2);

DO $$
BEGIN
  UPDATE public.crm_servicos
     SET categ_serv = 'Clientes - Serviços Prestados'
   WHERE categ_serv IS NULL OR btrim(categ_serv) = '';

  ALTER TABLE public.crm_servicos
    ALTER COLUMN categ_serv SET DEFAULT 'Clientes - Serviços Prestados';

  ALTER TABLE public.crm_servicos
    ALTER COLUMN categ_serv SET NOT NULL;
END $$;

ALTER TABLE public.crm_servicos
  DROP CONSTRAINT IF EXISTS crm_servicos_valor_serv_check;

ALTER TABLE public.crm_servicos
  ADD CONSTRAINT crm_servicos_valor_serv_check
  CHECK (valor_serv IS NULL OR valor_serv >= 0);

UPDATE public.crm_servicos
   SET valor_serv = servicos_valor
 WHERE valor_serv IS NULL
   AND servicos_valor IS NOT NULL;

COMMIT;

