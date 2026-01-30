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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_permissoes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legacy_profile_permissoes'
  ) THEN
    ALTER TABLE public.profile_permissoes RENAME TO legacy_profile_permissoes;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'permissoes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legacy_permissoes'
  ) THEN
    ALTER TABLE public.permissoes RENAME TO legacy_permissoes;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.perfis (
  perfil_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_nome text NOT NULL UNIQUE,
  perfil_descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_perfis_updated_at') THEN
    CREATE TRIGGER trg_perfis_updated_at
    BEFORE UPDATE ON public.perfis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.permissoes (
  permissao_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  acao text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissoes_modulo_acao_unique UNIQUE (modulo, acao)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_permissoes_updated_at') THEN
    CREATE TRIGGER trg_permissoes_updated_at
    BEFORE UPDATE ON public.permissoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  perfil_id uuid NOT NULL REFERENCES public.perfis(perfil_id) ON DELETE CASCADE,
  permissao_id uuid NOT NULL REFERENCES public.permissoes(permissao_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS public.profile_perfis (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.perfis(perfil_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profile_perfis_updated_at') THEN
    CREATE TRIGGER trg_profile_perfis_updated_at
    BEFORE UPDATE ON public.profile_perfis
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfis_authenticated_select ON public.perfis;
DROP POLICY IF EXISTS permissoes_authenticated_select ON public.permissoes;
DROP POLICY IF EXISTS perfil_permissoes_authenticated_select ON public.perfil_permissoes;
DROP POLICY IF EXISTS profile_perfis_authenticated_select ON public.profile_perfis;

DROP POLICY IF EXISTS perfis_service_role_all ON public.perfis;
DROP POLICY IF EXISTS permissoes_service_role_all ON public.permissoes;
DROP POLICY IF EXISTS perfil_permissoes_service_role_all ON public.perfil_permissoes;
DROP POLICY IF EXISTS profile_perfis_service_role_all ON public.profile_perfis;

CREATE POLICY perfis_service_role_all ON public.perfis FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY permissoes_service_role_all ON public.permissoes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY perfil_permissoes_service_role_all ON public.perfil_permissoes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY profile_perfis_service_role_all ON public.profile_perfis FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, modulo text, acao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_perfis pp
    JOIN public.perfil_permissoes pps ON pps.perfil_id = pp.perfil_id
    JOIN public.permissoes p ON p.permissao_id = pps.permissao_id
    WHERE pp.user_id = user_id
      AND p.modulo = modulo
      AND p.acao = acao
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (modulo text, acao text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.modulo, p.acao
  FROM public.profile_perfis pp
  JOIN public.perfil_permissoes pps ON pps.perfil_id = pp.perfil_id
  JOIN public.permissoes p ON p.permissao_id = pps.permissao_id
  WHERE pp.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

INSERT INTO public.perfis (perfil_nome, perfil_descricao)
VALUES
  ('ADMIN', 'Administrador do sistema'),
  ('VENDEDOR', 'Acesso comercial padrão'),
  ('FINANCEIRO', 'Acesso financeiro'),
  ('PRODUCAO', 'Acesso produção')
ON CONFLICT (perfil_nome) DO NOTHING;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('CONFIGURACOES', 'MANAGE', 'Gerenciar usuários e permissões'),
  ('CRM', 'VIEW', 'Visualizar CRM'),
  ('CRM', 'MANAGE', 'Gerenciar configurações do CRM'),
  ('CLIENTES', 'VIEW', 'Visualizar clientes'),
  ('CLIENTES', 'CREATE', 'Criar clientes'),
  ('CLIENTES', 'EDIT', 'Editar clientes'),
  ('CLIENTES', 'DELETE', 'Excluir (soft delete) clientes e contatos'),
  ('CLIENTES', 'MANAGE', 'Acesso global a clientes e contatos')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr ON true
WHERE pf.perfil_nome = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao IN ('VIEW','CREATE','EDIT'))
WHERE pf.perfil_nome = 'VENDEDOR'
ON CONFLICT DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON (pr.modulo = 'CRM' AND pr.acao = 'VIEW')
  OR (pr.modulo = 'CLIENTES' AND pr.acao = 'VIEW')
WHERE pf.perfil_nome = 'FINANCEIRO'
ON CONFLICT DO NOTHING;

INSERT INTO public.profile_perfis (user_id, perfil_id)
SELECT p.id,
       (SELECT perfil_id FROM public.perfis WHERE perfil_nome = CASE
         WHEN p.cargo::text = 'ADMIN' THEN 'ADMIN'
         WHEN p.cargo::text = 'FINANCEIRO' THEN 'FINANCEIRO'
         WHEN p.cargo::text IN ('OFICINA','TECNICO') THEN 'PRODUCAO'
         ELSE 'VENDEDOR'
       END)
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.profile_perfis pp WHERE pp.user_id = p.id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_service_role_all ON public.profiles;

CREATE POLICY profiles_select_public ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_service_role_all ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, nome, avatar_url, cargo, status, last_seen, created_at, updated_at) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (nome, email_corporativo, telefone, ramal, avatar_url) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_barrier = true)
AS
  SELECT id, nome, avatar_url, cargo, status, last_seen
  FROM public.profiles;

GRANT SELECT ON TABLE public.profiles_public TO authenticated;

CREATE OR REPLACE VIEW public.profiles_private
WITH (security_barrier = true)
AS
  SELECT id, nome, email_login, email_corporativo, telefone, ramal, ativo, avatar_url, cargo, status, last_seen, created_at, updated_at
  FROM public.profiles
  WHERE id = auth.uid();

GRANT SELECT ON TABLE public.profiles_private TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_email_login') THEN
    CREATE INDEX idx_profiles_email_login ON public.profiles(email_login);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_nome') THEN
    CREATE INDEX idx_profiles_nome ON public.profiles(nome);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.crm_motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_origem_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_verticais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_motivos_select_auth ON public.crm_motivos;
DROP POLICY IF EXISTS crm_motivos_all_auth ON public.crm_motivos;
DROP POLICY IF EXISTS crm_origem_leads_select_auth ON public.crm_origem_leads;
DROP POLICY IF EXISTS crm_origem_leads_all_auth ON public.crm_origem_leads;
DROP POLICY IF EXISTS crm_produtos_select_auth ON public.crm_produtos;
DROP POLICY IF EXISTS crm_produtos_all_auth ON public.crm_produtos;
DROP POLICY IF EXISTS crm_servicos_select_auth ON public.crm_servicos;
DROP POLICY IF EXISTS crm_servicos_all_auth ON public.crm_servicos;
DROP POLICY IF EXISTS crm_verticais_select_auth ON public.crm_verticais;
DROP POLICY IF EXISTS crm_verticais_all_auth ON public.crm_verticais;

DROP POLICY IF EXISTS crm_motivos_write_manage ON public.crm_motivos;
DROP POLICY IF EXISTS crm_motivos_update_manage ON public.crm_motivos;
DROP POLICY IF EXISTS crm_motivos_delete_manage ON public.crm_motivos;
DROP POLICY IF EXISTS crm_origem_leads_write_manage ON public.crm_origem_leads;
DROP POLICY IF EXISTS crm_origem_leads_update_manage ON public.crm_origem_leads;
DROP POLICY IF EXISTS crm_origem_leads_delete_manage ON public.crm_origem_leads;
DROP POLICY IF EXISTS crm_produtos_write_manage ON public.crm_produtos;
DROP POLICY IF EXISTS crm_produtos_update_manage ON public.crm_produtos;
DROP POLICY IF EXISTS crm_produtos_delete_manage ON public.crm_produtos;
DROP POLICY IF EXISTS crm_servicos_write_manage ON public.crm_servicos;
DROP POLICY IF EXISTS crm_servicos_update_manage ON public.crm_servicos;
DROP POLICY IF EXISTS crm_servicos_delete_manage ON public.crm_servicos;
DROP POLICY IF EXISTS crm_verticais_write_manage ON public.crm_verticais;
DROP POLICY IF EXISTS crm_verticais_update_manage ON public.crm_verticais;
DROP POLICY IF EXISTS crm_verticais_delete_manage ON public.crm_verticais;

CREATE POLICY crm_motivos_select_auth ON public.crm_motivos FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_origem_leads_select_auth ON public.crm_origem_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_produtos_select_auth ON public.crm_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_servicos_select_auth ON public.crm_servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_verticais_select_auth ON public.crm_verticais FOR SELECT TO authenticated USING (true);

CREATE POLICY crm_motivos_write_manage ON public.crm_motivos FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_motivos_update_manage ON public.crm_motivos FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE')) WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_motivos_delete_manage ON public.crm_motivos FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));

CREATE POLICY crm_origem_leads_write_manage ON public.crm_origem_leads FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_origem_leads_update_manage ON public.crm_origem_leads FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE')) WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_origem_leads_delete_manage ON public.crm_origem_leads FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));

CREATE POLICY crm_produtos_write_manage ON public.crm_produtos FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_produtos_update_manage ON public.crm_produtos FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE')) WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_produtos_delete_manage ON public.crm_produtos FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));

CREATE POLICY crm_servicos_write_manage ON public.crm_servicos FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_servicos_update_manage ON public.crm_servicos FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE')) WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_servicos_delete_manage ON public.crm_servicos FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));

CREATE POLICY crm_verticais_write_manage ON public.crm_verticais FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_verticais_update_manage ON public.crm_verticais FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE')) WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));
CREATE POLICY crm_verticais_delete_manage ON public.crm_verticais FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'CRM', 'MANAGE'));

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_select_own_active ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_own ON public.clientes;
DROP POLICY IF EXISTS clientes_update_own_active ON public.clientes;
DROP POLICY IF EXISTS clientes_service_role_all ON public.clientes;

DROP POLICY IF EXISTS clientes_select_final ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_final ON public.clientes;
DROP POLICY IF EXISTS clientes_update_final ON public.clientes;

CREATE POLICY clientes_select_final
  ON public.clientes FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')));

CREATE POLICY clientes_insert_final
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND (user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')));

CREATE POLICY clientes_update_final
  ON public.clientes FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')))
  WITH CHECK (
    (user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE'))
    AND (deleted_at IS NULL OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE'))
  );

CREATE POLICY clientes_service_role_all
  ON public.clientes FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS clientes_contatos_select ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_insert ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_update ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_select_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_insert_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_update_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_service_role_all ON public.clientes_contatos;

DROP POLICY IF EXISTS clientes_contatos_select_final ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_insert_final ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_update_final ON public.clientes_contatos;

CREATE POLICY clientes_contatos_select_final
  ON public.clientes_contatos FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.cliente_id = clientes_contatos.cliente_id
        AND c.deleted_at IS NULL
        AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE'))
    )
  );

CREATE POLICY clientes_contatos_insert_final
  ON public.clientes_contatos FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (
      public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
      OR (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY clientes_contatos_update_final
  ON public.clientes_contatos FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.cliente_id = clientes_contatos.cliente_id
        AND c.deleted_at IS NULL
        AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE'))
    )
  )
  WITH CHECK (
    (
      public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
      OR EXISTS (
        SELECT 1
        FROM public.clientes c
        WHERE c.cliente_id = clientes_contatos.cliente_id
          AND c.deleted_at IS NULL
          AND c.user_id = auth.uid()
      )
    )
    AND (deleted_at IS NULL OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE'))
  );

CREATE POLICY clientes_contatos_service_role_all
  ON public.clientes_contatos FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
