BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    ALTER TABLE public.crm_produtos
      DROP CONSTRAINT IF EXISTS crm_produtos_local_estoque_check;

    ALTER TABLE public.crm_produtos
      DROP COLUMN IF EXISTS local_estoque;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_movimentacoes_estoque (
  mov_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prod_id UUID NOT NULL REFERENCES public.crm_produtos(prod_id) ON DELETE RESTRICT,
  tipo_movimentacao TEXT NOT NULL,
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantidade NUMERIC(15, 2) NOT NULL,
  local_estoque TEXT NOT NULL,
  motivo TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.crm_movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS crm_movimentacoes_estoque_tipo_check;

ALTER TABLE public.crm_movimentacoes_estoque
  ADD CONSTRAINT crm_movimentacoes_estoque_tipo_check
  CHECK (tipo_movimentacao IN ('Entrada', 'Saida', 'Ajuste', 'Transferencia'));

ALTER TABLE public.crm_movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS crm_movimentacoes_estoque_quantidade_check;

ALTER TABLE public.crm_movimentacoes_estoque
  ADD CONSTRAINT crm_movimentacoes_estoque_quantidade_check
  CHECK (quantidade <> 0);

ALTER TABLE public.crm_movimentacoes_estoque
  DROP CONSTRAINT IF EXISTS crm_movimentacoes_estoque_local_check;

ALTER TABLE public.crm_movimentacoes_estoque
  ADD CONSTRAINT crm_movimentacoes_estoque_local_check
  CHECK (btrim(local_estoque) <> '');

CREATE INDEX IF NOT EXISTS idx_crm_mov_estoque_prod_local_data
  ON public.crm_movimentacoes_estoque (prod_id, local_estoque, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_crm_mov_estoque_prod_data
  ON public.crm_movimentacoes_estoque (prod_id, data_movimentacao DESC);

ALTER TABLE public.crm_movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'crm_movimentacoes_estoque'
       AND policyname = 'crm_movimentacoes_estoque_select_compras_estoque'
  ) THEN
    CREATE POLICY crm_movimentacoes_estoque_select_compras_estoque
      ON public.crm_movimentacoes_estoque
      FOR SELECT
      TO authenticated
      USING (
        public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'VIEW')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      );
  END IF;
END $$;

REVOKE ALL ON TABLE public.crm_movimentacoes_estoque FROM anon, authenticated;
GRANT SELECT ON TABLE public.crm_movimentacoes_estoque TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.crm_movimentacoes_estoque TO service_role;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.vw_saldo_produto AS
SELECT
  prod_id,
  local_estoque,
  SUM(
    CASE
      WHEN tipo_movimentacao = 'Entrada' THEN quantidade
      WHEN tipo_movimentacao = 'Saida' THEN -quantidade
      WHEN tipo_movimentacao = 'Ajuste' THEN quantidade
      ELSE 0
    END
  ) AS saldo
FROM public.crm_movimentacoes_estoque
GROUP BY prod_id, local_estoque;

REVOKE ALL ON TABLE public.vw_saldo_produto FROM anon, authenticated;
GRANT SELECT ON TABLE public.vw_saldo_produto TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_movimentar_estoque_admin(
  p_prod_id UUID,
  p_tipo_movimentacao TEXT,
  p_quantidade NUMERIC,
  p_local_origem TEXT,
  p_motivo TEXT,
  p_user_id UUID,
  p_local_destino TEXT DEFAULT NULL,
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
      local_estoque,
      motivo,
      user_id
    ) VALUES (
      p_prod_id,
      'Saida',
      p_data_movimentacao,
      ABS(p_quantidade),
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
      local_estoque,
      motivo,
      user_id
    ) VALUES (
      p_prod_id,
      'Entrada',
      p_data_movimentacao,
      ABS(p_quantidade),
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
    local_estoque,
    motivo,
    user_id
  ) VALUES (
    p_prod_id,
    p_tipo_movimentacao,
    p_data_movimentacao,
    p_quantidade,
    p_local_origem,
    NULLIF(btrim(p_motivo), ''),
    p_user_id
  )
  RETURNING * INTO v_saida;

  RETURN NEXT v_saida;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_movimentar_estoque_admin(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.crm_movimentar_estoque_admin(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) TO service_role;
  END IF;
END $$;

COMMIT;
