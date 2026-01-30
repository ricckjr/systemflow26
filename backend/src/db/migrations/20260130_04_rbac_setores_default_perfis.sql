BEGIN;

UPDATE public.perfis
SET perfil_nome = 'ADMINISTRADOR',
    perfil_descricao = 'Administrador do sistema'
WHERE perfil_nome = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM public.perfis p2 WHERE p2.perfil_nome = 'ADMINISTRADOR');

UPDATE public.perfis
SET perfil_descricao = 'Administrador do sistema'
WHERE perfil_nome IN ('ADMIN', 'ADMINISTRADOR');

UPDATE public.perfis
SET perfil_nome = 'COMERCIAL',
    perfil_descricao = 'Acesso do setor comercial'
WHERE perfil_nome = 'VENDEDOR'
  AND NOT EXISTS (SELECT 1 FROM public.perfis p2 WHERE p2.perfil_nome = 'COMERCIAL');

UPDATE public.perfis
SET perfil_descricao = 'Acesso do setor comercial'
WHERE perfil_nome IN ('VENDEDOR', 'COMERCIAL');

UPDATE public.perfis
SET perfil_nome = 'OFICINA',
    perfil_descricao = 'Acesso do setor oficina'
WHERE perfil_nome = 'PRODUCAO'
  AND NOT EXISTS (SELECT 1 FROM public.perfis p2 WHERE p2.perfil_nome = 'OFICINA');

UPDATE public.perfis
SET perfil_descricao = 'Acesso do setor oficina'
WHERE perfil_nome IN ('PRODUCAO', 'OFICINA');

INSERT INTO public.perfis (perfil_nome, perfil_descricao)
VALUES
  ('ADMINISTRATIVO', 'Acesso do setor administrativo'),
  ('LOGISTICA', 'Acesso do setor logística'),
  ('ELETRONICA', 'Acesso do setor eletrônica'),
  ('LABORATÓRIO', 'Acesso do setor laboratório')
ON CONFLICT (perfil_nome) DO NOTHING;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('DASHBOARD', 'VIEW', 'Visualizar dashboards'),
  ('COMUNIDADE', 'VIEW', 'Acessar comunidade'),
  ('UNIVERSIDADE', 'VIEW', 'Acessar universidade'),
  ('PRODUCAO', 'VIEW', 'Visualizar produção'),
  ('PRODUCAO', 'MANAGE', 'Gerenciar produção'),
  ('FROTA', 'VIEW', 'Visualizar frota'),
  ('FROTA', 'MANAGE', 'Gerenciar frota'),
  ('SMARTFLOW', 'VIEW', 'Visualizar SmartFlow'),
  ('SMARTFLOW', 'MANAGE', 'Gerenciar SmartFlow')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr ON true
WHERE pf.perfil_nome IN ('ADMINISTRADOR', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'CONFIGURACOES' AND pr.acao = 'MANAGE')
WHERE pf.perfil_nome = 'ADMINISTRATIVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'DASHBOARD' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'COMUNIDADE' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'UNIVERSIDADE' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao IN ('VIEW','CREATE','EDIT'))
WHERE pf.perfil_nome IN ('COMERCIAL', 'VENDEDOR')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'DASHBOARD' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'COMUNIDADE' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'UNIVERSIDADE' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao IN ('VIEW','EDIT'))
WHERE pf.perfil_nome = 'ADMINISTRATIVO'
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'DASHBOARD' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao = 'VIEW')
WHERE pf.perfil_nome IN ('FINANCEIRO', 'LOGISTICA')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'DASHBOARD' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'PRODUCAO' AND pr.acao IN ('VIEW','MANAGE'))
WHERE pf.perfil_nome IN ('OFICINA', 'PRODUCAO')
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'DASHBOARD' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'PRODUCAO' AND pr.acao = 'VIEW')
WHERE pf.perfil_nome IN ('ELETRONICA', 'LABORATÓRIO')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_default_perfil_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_name text;
  target_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profile_perfis pp WHERE pp.user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  target_name := CASE
    WHEN NEW.cargo::text IN ('ADMIN', 'ADMINISTRADOR') THEN 'ADMINISTRADOR'
    WHEN NEW.cargo::text IN ('COMERCIAL', 'VENDEDOR') THEN 'COMERCIAL'
    WHEN NEW.cargo::text = 'ADMINISTRATIVO' THEN 'ADMINISTRATIVO'
    WHEN NEW.cargo::text = 'FINANCEIRO' THEN 'FINANCEIRO'
    WHEN NEW.cargo::text = 'LOGISTICA' THEN 'LOGISTICA'
    WHEN NEW.cargo::text = 'ELETRONICA' THEN 'ELETRONICA'
    WHEN NEW.cargo::text IN ('LABORATORIO', 'LABORATÓRIO') THEN 'LABORATÓRIO'
    WHEN NEW.cargo::text IN ('OFICINA', 'PRODUCAO', 'TECNICO') THEN 'OFICINA'
    ELSE 'COMERCIAL'
  END;

  SELECT perfil_id INTO target_id
  FROM public.perfis
  WHERE perfil_nome = target_name
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profile_perfis (user_id, perfil_id)
  VALUES (NEW.id, target_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_perfil_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_assign_default_perfil_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_perfil_on_profile_insert();

COMMIT;
