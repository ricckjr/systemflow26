BEGIN;

DO $$
BEGIN
  IF to_regclass('public.servics_equipamento') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.servics_equipamento
    ADD COLUMN IF NOT EXISTS solicitacao_cliente text;

  COMMENT ON COLUMN public.servics_equipamento.solicitacao_cliente IS 'Solicitação do cliente na entrada do equipamento.';
END $$;

COMMIT;

