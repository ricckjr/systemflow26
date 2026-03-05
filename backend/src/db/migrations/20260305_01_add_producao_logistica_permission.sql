BEGIN;

DO $$
DECLARE
  acoes text[] := ARRAY['VIEW','EDIT','CONTROL'];
BEGIN
  IF to_regclass('public.permissoes') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissoes (modulo, acao, descricao)
  SELECT p.modulo, a, p.descricao
  FROM (
    VALUES
      ('PAGINA__PRODUCAO__LOGISTICA', 'Produção — Logística')
  ) AS p(modulo, descricao)
  CROSS JOIN unnest(acoes) AS a
  ON CONFLICT (modulo, acao) DO NOTHING;
END $$;

COMMIT;

