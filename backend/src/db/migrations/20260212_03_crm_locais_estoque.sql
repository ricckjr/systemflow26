BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_locais_estoque (
  local_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'uq_crm_locais_estoque_nome'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_crm_locais_estoque_nome ON public.crm_locais_estoque (nome)';
  END IF;
END $$;

DO $$
BEGIN
  INSERT INTO public.crm_locais_estoque (nome, ativo)
  VALUES
    ('Prateleira A', true),
    ('Prateleira B', true)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_movimentacoes_estoque') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crm_movimentacoes_estoque
     SET local_estoque = 'Prateleira A'
   WHERE local_estoque IN ('03', 'PADRAO');

  UPDATE public.crm_movimentacoes_estoque
     SET local_estoque = 'Prateleira B'
   WHERE local_estoque IN ('04', 'INTERNO');
END $$;

ALTER TABLE public.crm_locais_estoque ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'crm_locais_estoque'
       AND policyname = 'crm_locais_estoque_select_compras_estoque'
  ) THEN
    CREATE POLICY crm_locais_estoque_select_compras_estoque
      ON public.crm_locais_estoque
      FOR SELECT
      TO authenticated
      USING (
        public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'VIEW')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
        OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      );
  END IF;
END $$;

REVOKE ALL ON TABLE public.crm_locais_estoque FROM anon, authenticated;
GRANT SELECT ON TABLE public.crm_locais_estoque TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.crm_locais_estoque TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_movimentacoes_estoque') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $fn$
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
AS $body$
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

  IF NOT EXISTS (
    SELECT 1
      FROM public.crm_locais_estoque le
     WHERE le.nome = p_local_origem
       AND le.ativo = true
  ) THEN
    RAISE EXCEPTION 'local_estoque inválido';
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

    IF p_local_destino = p_local_origem THEN
      RAISE EXCEPTION 'local_destino deve ser diferente do local_origem';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.crm_locais_estoque le
       WHERE le.nome = p_local_destino
         AND le.ativo = true
    ) THEN
      RAISE EXCEPTION 'local_destino inválido';
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
$body$;
$fn$;
END $$;

COMMIT;
