BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_perfil_on_profile_insert ON public.profiles;
DROP FUNCTION IF EXISTS public.assign_default_perfil_on_profile_insert();

DO $$
BEGIN
  IF to_regclass('public.profile_perfis') IS NOT NULL AND to_regclass('public.legacy_profile_perfis') IS NULL THEN
    ALTER TABLE public.profile_perfis RENAME TO legacy_profile_perfis;
  END IF;
  IF to_regclass('public.perfil_permissoes') IS NOT NULL AND to_regclass('public.legacy_perfil_permissoes') IS NULL THEN
    ALTER TABLE public.perfil_permissoes RENAME TO legacy_perfil_permissoes;
  END IF;
  IF to_regclass('public.permissoes') IS NOT NULL AND to_regclass('public.legacy_permissoes') IS NULL THEN
    ALTER TABLE public.permissoes RENAME TO legacy_permissoes;
  END IF;
  IF to_regclass('public.perfis') IS NOT NULL AND to_regclass('public.legacy_perfis') IS NULL THEN
    ALTER TABLE public.perfis RENAME TO legacy_perfis;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roles_updated_at') THEN
    CREATE TRIGGER trg_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  modulo text NOT NULL,
  acao text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_modulo_acao_unique UNIQUE (modulo, acao)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_permissions_updated_at') THEN
    CREATE TRIGGER trg_permissions_updated_at
    BEFORE UPDATE ON public.permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_roles_user_id') THEN
    CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_roles_role_id') THEN
    CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_role_permissions_role_id') THEN
    CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_role_permissions_permission_id') THEN
    CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_permissions_modulo_acao') THEN
    CREATE INDEX idx_permissions_modulo_acao ON public.permissions(modulo, acao);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_permissions_codigo') THEN
    CREATE INDEX idx_permissions_codigo ON public.permissions(codigo);
  END IF;
END $$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_service_role_all ON public.roles;
DROP POLICY IF EXISTS permissions_service_role_all ON public.permissions;
DROP POLICY IF EXISTS role_permissions_service_role_all ON public.role_permissions;
DROP POLICY IF EXISTS user_roles_service_role_all ON public.user_roles;

CREATE POLICY roles_service_role_all ON public.roles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY permissions_service_role_all ON public.permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY role_permissions_service_role_all ON public.role_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY user_roles_service_role_all ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF to_regclass('public.legacy_perfis') IS NOT NULL THEN
    INSERT INTO public.roles (id, nome, descricao, ativo, created_at, updated_at)
    SELECT lp.perfil_id, lp.perfil_nome, lp.perfil_descricao, true, lp.created_at, lp.updated_at
    FROM public.legacy_perfis lp
    ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        ativo = EXCLUDED.ativo,
        updated_at = now();
  END IF;

  IF to_regclass('public.legacy_permissoes') IS NOT NULL THEN
    INSERT INTO public.permissions (id, codigo, modulo, acao, descricao, created_at, updated_at)
    SELECT
      lperm.permissao_id,
      lower(lperm.modulo) || '.' || lower(
        CASE lperm.acao
          WHEN 'VIEW' THEN 'read'
          WHEN 'EDIT' THEN 'write'
          WHEN 'CONTROL' THEN 'control'
          WHEN 'MANAGE' THEN 'manage'
          WHEN 'CREATE' THEN 'create'
          WHEN 'DELETE' THEN 'delete'
          ELSE lperm.acao
        END
      ),
      lperm.modulo,
      lperm.acao,
      lperm.descricao,
      lperm.created_at,
      lperm.updated_at
    FROM public.legacy_permissoes lperm
    ON CONFLICT (id) DO UPDATE
    SET codigo = EXCLUDED.codigo,
        modulo = EXCLUDED.modulo,
        acao = EXCLUDED.acao,
        descricao = EXCLUDED.descricao,
        updated_at = now();
  END IF;

  IF to_regclass('public.legacy_perfil_permissoes') IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id, created_at)
    SELECT lpp.perfil_id, lpp.permissao_id, lpp.created_at
    FROM public.legacy_perfil_permissoes lpp
    ON CONFLICT DO NOTHING;
  END IF;

  IF to_regclass('public.legacy_profile_perfis') IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id, created_at)
    SELECT lpr.user_id, lpr.perfil_id, lpr.created_at
    FROM public.legacy_profile_perfis lpr
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

INSERT INTO public.roles (nome, descricao, ativo)
VALUES ('USUARIO', 'Acesso mínimo padrão', true)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.permissions (codigo, modulo, acao, descricao)
VALUES
  ('dashboard.read', 'DASHBOARD', 'VIEW', 'Visualizar dashboards'),
  ('crm.read', 'CRM', 'VIEW', 'Visualizar CRM'),
  ('crm.write', 'CRM', 'EDIT', 'Criar/editar CRM'),
  ('crm.control', 'CRM', 'CONTROL', 'Controlar/administrar CRM'),
  ('estoque.read', 'COMPRAS_E_ESTOQUE', 'VIEW', 'Visualizar Compras e Estoque'),
  ('estoque.movimentar', 'COMPRAS_E_ESTOQUE', 'MOVIMENTAR', 'Movimentar estoque'),
  ('financeiro.read', 'FINANCEIRO', 'VIEW', 'Visualizar Financeiro'),
  ('financeiro.aprovar_pagamento', 'FINANCEIRO', 'APROVAR_PAGAMENTO', 'Aprovar pagamentos'),
  ('configuracoes.control', 'CONFIGURACOES', 'CONTROL', 'Gerenciar acessos e configurações')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.codigo = 'dashboard.read'
WHERE r.nome = 'USUARIO'
ON CONFLICT DO NOTHING;

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
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = user_id
      AND p.modulo = (SELECT p_modulo FROM args)
  )
  SELECT CASE
    WHEN (SELECT p_acao FROM args) = 'VIEW' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao IN ('VIEW','EDIT','CONTROL','MANAGE'))
    WHEN (SELECT p_acao FROM args) = 'EDIT' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao IN ('EDIT','CONTROL','MANAGE'))
    WHEN (SELECT p_acao FROM args) = 'CONTROL' THEN EXISTS (SELECT 1 FROM perms WHERE perms.acao IN ('CONTROL','MANAGE'))
    ELSE EXISTS (SELECT 1 FROM perms WHERE perms.acao = (SELECT p_acao FROM args))
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.codigo = permission_code
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (codigo text, modulo text, acao text, descricao text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.codigo, p.modulo, p.acao, p.descricao
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_default_roles_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role_id uuid;
BEGIN
  SELECT id INTO target_role_id
  FROM public.roles
  WHERE nome = 'USUARIO'
  LIMIT 1;

  IF target_role_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, target_role_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_roles_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_assign_default_roles_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_roles_on_profile_insert();

COMMIT;
