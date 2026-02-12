BEGIN;

CREATE OR REPLACE FUNCTION public.crm_local_estoque_vinculos(
  p_nome TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  produtos_count INTEGER,
  quantidade_total NUMERIC,
  movimentos_count INTEGER,
  produtos JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT := btrim(COALESCE(p_nome, ''));
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
BEGIN
  IF v_nome = '' THEN
    RAISE EXCEPTION 'nome é obrigatório';
  END IF;

  IF NOT (
    public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
    OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  RETURN QUERY
  WITH saldo AS (
    SELECT v.prod_id, v.saldo
      FROM public.vw_saldo_produto v
     WHERE v.local_estoque = v_nome
  ),
  saldo_nz AS (
    SELECT s.prod_id, s.saldo
      FROM saldo s
     WHERE s.saldo <> 0
  ),
  top_produtos AS (
    SELECT s.prod_id, p.descricao_prod, s.saldo
      FROM saldo_nz s
      JOIN public.crm_produtos p ON p.prod_id = s.prod_id
     ORDER BY ABS(s.saldo) DESC, p.descricao_prod ASC
     LIMIT v_limit
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM saldo_nz) AS produtos_count,
    (SELECT COALESCE(SUM(saldo), 0) FROM saldo) AS quantidade_total,
    (SELECT COUNT(*)::INTEGER FROM public.crm_movimentacoes_estoque m WHERE m.local_estoque = v_nome) AS movimentos_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('prod_id', prod_id, 'descricao', descricao_prod, 'saldo', saldo)) FROM top_produtos),
      '[]'::jsonb
    ) AS produtos;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_local_estoque_vinculos(TEXT, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_local_estoque_vinculos(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_renomear_local_estoque_admin(
  p_local_id UUID,
  p_novo_nome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_id UUID := p_local_id;
  v_old_nome TEXT;
  v_new_nome TEXT := btrim(COALESCE(p_novo_nome, ''));
BEGIN
  IF v_local_id IS NULL THEN
    RAISE EXCEPTION 'local_id é obrigatório';
  END IF;

  IF v_new_nome = '' THEN
    RAISE EXCEPTION 'novo_nome é obrigatório';
  END IF;

  IF NOT (
    public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
    OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT le.nome
    INTO v_old_nome
    FROM public.crm_locais_estoque le
   WHERE le.local_id = v_local_id
   FOR UPDATE;

  IF v_old_nome IS NULL THEN
    RAISE EXCEPTION 'Local não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.crm_locais_estoque le
     WHERE le.nome = v_new_nome
       AND le.local_id <> v_local_id
  ) THEN
    RAISE EXCEPTION 'Já existe um local com esse nome';
  END IF;

  UPDATE public.crm_locais_estoque
     SET nome = v_new_nome,
         atualizado_em = NOW()
   WHERE local_id = v_local_id;

  UPDATE public.crm_movimentacoes_estoque
     SET local_estoque = v_new_nome
   WHERE local_estoque = v_old_nome;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_renomear_local_estoque_admin(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_renomear_local_estoque_admin(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_excluir_local_estoque_admin(
  p_local_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_id UUID := p_local_id;
  v_nome TEXT;
BEGIN
  IF v_local_id IS NULL THEN
    RAISE EXCEPTION 'local_id é obrigatório';
  END IF;

  IF NOT (
    public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
    OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT le.nome
    INTO v_nome
    FROM public.crm_locais_estoque le
   WHERE le.local_id = v_local_id
   FOR UPDATE;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Local não encontrado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.crm_movimentacoes_estoque m WHERE m.local_estoque = v_nome LIMIT 1) THEN
    RAISE EXCEPTION 'Não é possível excluir: existem movimentações vinculadas.' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vw_saldo_produto v WHERE v.local_estoque = v_nome AND v.saldo <> 0 LIMIT 1) THEN
    RAISE EXCEPTION 'Não é possível excluir: existe saldo vinculado.' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.crm_locais_estoque WHERE local_id = v_local_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_excluir_local_estoque_admin(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_excluir_local_estoque_admin(UUID) TO authenticated;

COMMIT;

