BEGIN;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('COMPRAS_E_ESTOQUE', 'VIEW', 'Visualizar Compras e Estoque'),
  ('COMPRAS_E_ESTOQUE', 'EDIT', 'Criar/editar em Compras e Estoque'),
  ('COMPRAS_E_ESTOQUE', 'CONTROL', 'Controle total de Compras e Estoque')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON pr.modulo = 'COMPRAS_E_ESTOQUE' AND pr.acao = 'CONTROL'
WHERE pf.perfil_nome IN ('ADMINISTRADOR', 'ADMIN')
ON CONFLICT DO NOTHING;

COMMIT;

