BEGIN;

ALTER TABLE public.crm_produtos
  ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(15, 2);

ALTER TABLE public.crm_produtos
  DROP CONSTRAINT IF EXISTS crm_produtos_valor_compra_check;

ALTER TABLE public.crm_produtos
  ADD CONSTRAINT crm_produtos_valor_compra_check
  CHECK (valor_compra IS NULL OR valor_compra >= 0);

ALTER TABLE public.crm_movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS valor_compra_unit NUMERIC(15, 2);

ALTER TABLE public.crm_movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS crm_movimentacoes_estoque_valor_compra_unit_check;

ALTER TABLE public.crm_movimentacoes_estoque
  ADD CONSTRAINT crm_movimentacoes_estoque_valor_compra_unit_check
  CHECK (valor_compra_unit IS NULL OR valor_compra_unit >= 0);

CREATE OR REPLACE FUNCTION public.crm_movimentar_estoque_admin(
  p_prod_id UUID,
  p_tipo_movimentacao TEXT,
  p_quantidade NUMERIC,
  p_local_origem TEXT,
  p_motivo TEXT,
  p_user_id UUID,
  p_local_destino TEXT DEFAULT NULL,
  p_valor_compra_unit NUMERIC DEFAULT NULL,
  p_data_movimentacao TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SETOF public.crm_movimentacoes_estoque
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_origem NUMERIC := 0;
  v_saida public.crm_movimentacoes_estoque%ROWTYPE;
  v_entrada public.crm_movimentacoes_estoque%ROWTYPE;
BEGIN
  IF p_prod_id IS NULL THEN
    RAISE EXCEPTION 'prod_id é obrigatório';
  END IF;

  IF p_tipo_movimentacao IS NULL OR btrim(p_tipo_movimentacao) = '' THEN
    RAISE EXCEPTION 'tipo_movimentacao é obrigatório';
  END IF;

  IF p_tipo_movimentacao NOT IN ('Entrada', 'Saida', 'Ajuste', 'Transferencia') THEN
    RAISE EXCEPTION 'tipo_movimentacao inválido';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade = 0 THEN
    RAISE EXCEPTION 'quantidade inválida';
  END IF;

  IF p_tipo_movimentacao <> 'Ajuste' AND p_quantidade < 0 THEN
    RAISE EXCEPTION 'quantidade deve ser maior que zero';
  END IF;

  IF p_local_origem IS NULL OR btrim(p_local_origem) = '' THEN
    RAISE EXCEPTION 'local_estoque é obrigatório';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;

  IF p_valor_compra_unit IS NOT NULL AND p_valor_compra_unit < 0 THEN
    RAISE EXCEPTION 'valor_compra_unit inválido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_prod_id::text || '|' || p_local_origem));

  SELECT COALESCE(SUM(
    CASE
      WHEN tipo_movimentacao = 'Entrada' THEN quantidade
      WHEN tipo_movimentacao = 'Saida' THEN -quantidade
      WHEN tipo_movimentacao = 'Ajuste' THEN quantidade
      ELSE 0
    END
  ), 0)
    INTO v_saldo_origem
    FROM public.crm_movimentacoes_estoque
   WHERE prod_id = p_prod_id
     AND local_estoque = p_local_origem;

  IF p_tipo_movimentacao IN ('Saida', 'Transferencia') AND v_saldo_origem < ABS(p_quantidade) THEN
    RAISE EXCEPTION 'Saldo insuficiente para saída (%). Saldo atual: %', p_local_origem, v_saldo_origem;
  END IF;

  IF p_tipo_movimentacao = 'Transferencia' THEN
    IF p_local_destino IS NULL OR btrim(p_local_destino) = '' THEN
      RAISE EXCEPTION 'local_destino é obrigatório para transferência';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_prod_id::text || '|' || p_local_destino));

    INSERT INTO public.crm_movimentacoes_estoque (
      prod_id,
      tipo_movimentacao,
      data_movimentacao,
      quantidade,
      valor_compra_unit,
      local_estoque,
      motivo,
      user_id
    ) VALUES (
      p_prod_id,
      'Saida',
      p_data_movimentacao,
      ABS(p_quantidade),
      p_valor_compra_unit,
      p_local_origem,
      COALESCE(p_motivo, 'Transferência'),
      p_user_id
    )
    RETURNING * INTO v_saida;

    INSERT INTO public.crm_movimentacoes_estoque (
      prod_id,
      tipo_movimentacao,
      data_movimentacao,
      quantidade,
      valor_compra_unit,
      local_estoque,
      motivo,
      user_id
    ) VALUES (
      p_prod_id,
      'Entrada',
      p_data_movimentacao,
      ABS(p_quantidade),
      p_valor_compra_unit,
      p_local_destino,
      COALESCE(p_motivo, 'Transferência'),
      p_user_id
    )
    RETURNING * INTO v_entrada;

    RETURN NEXT v_saida;
    RETURN NEXT v_entrada;
    RETURN;
  END IF;

  INSERT INTO public.crm_movimentacoes_estoque (
    prod_id,
    tipo_movimentacao,
    data_movimentacao,
    quantidade,
    valor_compra_unit,
    local_estoque,
    motivo,
    user_id
  ) VALUES (
    p_prod_id,
    p_tipo_movimentacao,
    p_data_movimentacao,
    p_quantidade,
    p_valor_compra_unit,
    p_local_origem,
    NULLIF(btrim(p_motivo), ''),
    p_user_id
  )
  RETURNING * INTO v_saida;

  RETURN NEXT v_saida;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_movimentar_estoque_admin(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, NUMERIC, TIMESTAMPTZ) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.crm_movimentar_estoque_admin(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, NUMERIC, TIMESTAMPTZ) TO service_role;
  END IF;
END $$;

COMMIT;

