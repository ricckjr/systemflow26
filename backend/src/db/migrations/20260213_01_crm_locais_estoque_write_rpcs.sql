BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_locais_estoque') IS NULL THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.crm_criar_local_estoque_admin(
    p_nome TEXT,
    p_ativo BOOLEAN DEFAULT true
  )
  RETURNS public.crm_locais_estoque
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_row public.crm_locais_estoque%ROWTYPE;
  BEGIN
    IF p_nome IS NULL OR btrim(p_nome) = '' THEN
      RAISE EXCEPTION 'nome é obrigatório';
    END IF;

    IF NOT (
      public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
    ) THEN
      RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
    END IF;

    INSERT INTO public.crm_locais_estoque (nome, ativo)
    VALUES (btrim(p_nome), COALESCE(p_ativo, true))
    RETURNING * INTO v_row;

    RETURN v_row;
  END;
  $fn$;

  CREATE OR REPLACE FUNCTION public.crm_set_local_estoque_ativo_admin(
    p_local_id UUID,
    p_ativo BOOLEAN
  )
  RETURNS public.crm_locais_estoque
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  DECLARE
    v_row public.crm_locais_estoque%ROWTYPE;
  BEGIN
    IF p_local_id IS NULL THEN
      RAISE EXCEPTION 'local_id é obrigatório';
    END IF;

    IF NOT (
      public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'EDIT')
      OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
      OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
    ) THEN
      RAISE EXCEPTION 'Permissão negada' USING errcode = '42501';
    END IF;

    UPDATE public.crm_locais_estoque
       SET ativo = COALESCE(p_ativo, true),
           atualizado_em = now()
     WHERE local_id = p_local_id
     RETURNING * INTO v_row;

    IF v_row.local_id IS NULL THEN
      RAISE EXCEPTION 'Local não encontrado';
    END IF;

    RETURN v_row;
  END;
  $fn$;

  REVOKE ALL ON FUNCTION public.crm_criar_local_estoque_admin(TEXT, BOOLEAN) FROM anon;
  GRANT EXECUTE ON FUNCTION public.crm_criar_local_estoque_admin(TEXT, BOOLEAN) TO authenticated;

  REVOKE ALL ON FUNCTION public.crm_set_local_estoque_ativo_admin(UUID, BOOLEAN) FROM anon;
  GRANT EXECUTE ON FUNCTION public.crm_set_local_estoque_ativo_admin(UUID, BOOLEAN) TO authenticated;
END $$;

COMMIT;

