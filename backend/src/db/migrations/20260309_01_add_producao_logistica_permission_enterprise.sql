BEGIN;

DO $$
DECLARE
  acoes text[] := ARRAY['VIEW','EDIT','CONTROL'];
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissions (codigo, modulo, acao, descricao)
  SELECT
    lower(p.modulo) || '.' || lower(
      CASE a
        WHEN 'VIEW' THEN 'read'
        WHEN 'EDIT' THEN 'write'
        WHEN 'CONTROL' THEN 'control'
        ELSE a
      END
    ),
    p.modulo,
    a,
    p.descricao
  FROM (
    VALUES
      ('PAGINA__PRODUCAO__LOGISTICA', 'Produção — Logística')
  ) AS p(modulo, descricao)
  CROSS JOIN unnest(acoes) AS a
  ON CONFLICT (modulo, acao) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, perm.id
  FROM public.roles r
  JOIN public.permissions perm
    ON perm.modulo = 'PAGINA__PRODUCAO__LOGISTICA'
   AND perm.acao = ANY(acoes)
  WHERE r.nome IN ('ADMIN', 'ADMINISTRADOR', 'PRODUCAO')
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
