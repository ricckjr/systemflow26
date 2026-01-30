BEGIN;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('DASHBOARD', 'VIEW', 'Visualizar o dashboard'),
  ('DASHBOARD', 'EDIT', 'Criar/editar itens do dashboard'),
  ('DASHBOARD', 'CONTROL', 'Controle total do dashboard'),

  ('UNIVERSIDADE', 'VIEW', 'Visualizar universidade'),
  ('UNIVERSIDADE', 'EDIT', 'Criar/editar conteúdos da universidade'),
  ('UNIVERSIDADE', 'CONTROL', 'Controle total da universidade'),

  ('CRM', 'VIEW', 'Visualizar CRM'),
  ('CRM', 'EDIT', 'Criar/editar no CRM'),
  ('CRM', 'CONTROL', 'Controle total do CRM'),

  ('PRODUCAO', 'VIEW', 'Visualizar produção'),
  ('PRODUCAO', 'EDIT', 'Criar/editar produção'),
  ('PRODUCAO', 'CONTROL', 'Controle total da produção'),

  ('FROTA', 'VIEW', 'Visualizar frota'),
  ('FROTA', 'EDIT', 'Criar/editar frota'),
  ('FROTA', 'CONTROL', 'Controle total da frota'),

  ('SMARTFLOW', 'VIEW', 'Visualizar SmartFlow'),
  ('SMARTFLOW', 'EDIT', 'Criar/editar SmartFlow'),
  ('SMARTFLOW', 'CONTROL', 'Controle total do SmartFlow'),

  ('CONFIGURACOES', 'VIEW', 'Visualizar Configurações'),
  ('CONFIGURACOES', 'EDIT', 'Criar/editar configurações'),
  ('CONFIGURACOES', 'CONTROL', 'Controle total de configurações (usuários e permissões)')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pps.perfil_id, pr_new.permissao_id
FROM public.perfil_permissoes pps
JOIN public.permissoes pr_old
  ON pr_old.permissao_id = pps.permissao_id
JOIN public.permissoes pr_new
  ON pr_new.modulo = pr_old.modulo AND pr_new.acao = 'CONTROL'
WHERE pr_old.acao = 'MANAGE'
  AND pr_old.modulo IN ('CRM', 'CONFIGURACOES', 'PRODUCAO', 'FROTA', 'SMARTFLOW', 'UNIVERSIDADE', 'DASHBOARD')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON pr.modulo IN ('DASHBOARD','UNIVERSIDADE','CRM','PRODUCAO','FROTA','SMARTFLOW','CONFIGURACOES')
 AND pr.acao = 'CONTROL'
WHERE pf.perfil_nome IN ('ADMINISTRADOR', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (
    (pr.modulo IN ('DASHBOARD','UNIVERSIDADE','SMARTFLOW') AND pr.acao = 'VIEW')
    OR (pr.modulo = 'CRM' AND pr.acao IN ('VIEW','EDIT'))
  )
WHERE pf.perfil_nome IN ('COMERCIAL', 'VENDEDOR')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (
    (pr.modulo IN ('DASHBOARD','UNIVERSIDADE','SMARTFLOW') AND pr.acao = 'VIEW')
    OR (pr.modulo = 'CONFIGURACOES' AND pr.acao = 'VIEW')
  )
WHERE pf.perfil_nome = 'ADMINISTRATIVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo IN ('DASHBOARD','UNIVERSIDADE','SMARTFLOW') AND pr.acao = 'VIEW')
WHERE pf.perfil_nome IN ('FINANCEIRO')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (
    (pr.modulo IN ('DASHBOARD','UNIVERSIDADE','SMARTFLOW') AND pr.acao = 'VIEW')
    OR (pr.modulo = 'FROTA' AND pr.acao = 'VIEW')
  )
WHERE pf.perfil_nome IN ('LOGISTICA')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (
    (pr.modulo IN ('DASHBOARD','UNIVERSIDADE','SMARTFLOW') AND pr.acao = 'VIEW')
    OR (pr.modulo = 'PRODUCAO' AND pr.acao = 'VIEW')
  )
WHERE pf.perfil_nome IN ('OFICINA', 'PRODUCAO', 'ELETRONICA', 'LABORATÓRIO')
ON CONFLICT DO NOTHING;

COMMIT;

