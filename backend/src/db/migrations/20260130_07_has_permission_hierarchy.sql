BEGIN;

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, modulo text, acao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH args AS (
    SELECT modulo AS p_modulo, acao AS p_acao
  ),
  perms AS (
    SELECT p.acao
    FROM public.profile_perfis pp
    JOIN public.perfil_permissoes pps ON pps.perfil_id = pp.perfil_id
    JOIN public.permissoes p ON p.permissao_id = pps.permissao_id
    WHERE pp.user_id = user_id
      AND p.modulo = (SELECT p_modulo FROM args)
  )
  SELECT CASE
    WHEN (SELECT p_acao FROM args) = 'VIEW' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao IN ('VIEW','EDIT','CONTROL'))
    WHEN (SELECT p_acao FROM args) = 'EDIT' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao IN ('EDIT','CONTROL'))
    WHEN (SELECT p_acao FROM args) = 'CONTROL' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao = 'CONTROL')
    ELSE EXISTS (SELECT 1 FROM perms WHERE perms.acao = (SELECT p_acao FROM args))
  END;
$$;

COMMIT;
