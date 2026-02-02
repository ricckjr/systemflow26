BEGIN;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('FINANCEIRO', 'VIEW', 'Visualizar financeiro'),
  ('FINANCEIRO', 'EDIT', 'Criar/editar no financeiro'),
  ('FINANCEIRO', 'CONTROL', 'Controle total do financeiro')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON pr.modulo = 'FINANCEIRO' AND pr.acao = 'CONTROL'
WHERE pf.perfil_nome IN ('ADMINISTRADOR', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON pr.modulo = 'FINANCEIRO' AND pr.acao IN ('VIEW','EDIT')
WHERE pf.perfil_nome IN ('FINANCEIRO')
ON CONFLICT DO NOTHING;

COMMIT;

