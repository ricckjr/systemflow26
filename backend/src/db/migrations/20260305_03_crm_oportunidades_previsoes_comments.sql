BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'prev_entrega'
  ) THEN
    COMMENT ON COLUMN public.crm_oportunidades.prev_entrega IS 'Data prevista em que o equipamento chega no cliente.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'prev_faturamento'
  ) THEN
    COMMENT ON COLUMN public.crm_oportunidades.prev_faturamento IS 'Data prevista para faturar a nota.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'validade_proposta'
  ) THEN
    COMMENT ON COLUMN public.crm_oportunidades.validade_proposta IS 'Data de validade da proposta.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'prev_fechamento'
  ) THEN
    COMMENT ON COLUMN public.crm_oportunidades.prev_fechamento IS 'Data prevista para fechar a venda com o cliente.';
  END IF;
END $$;

COMMIT;

