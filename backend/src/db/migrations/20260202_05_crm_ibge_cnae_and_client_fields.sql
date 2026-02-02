BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_ibge_codigos (
  ibge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_ibge TEXT NOT NULL UNIQUE,
  descricao_ibge TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_cnae_codigos (
  cnae_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_cnae TEXT NOT NULL UNIQUE,
  descricao_cnae TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_ibge_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cnae_codigos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_ibge_codigos' AND policyname = 'crm_ibge_codigos_select_auth'
  ) THEN
    CREATE POLICY crm_ibge_codigos_select_auth ON public.crm_ibge_codigos FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_ibge_codigos' AND policyname = 'crm_ibge_codigos_all_control'
  ) THEN
    CREATE POLICY crm_ibge_codigos_all_control
      ON public.crm_ibge_codigos
      FOR ALL TO authenticated
      USING (public.is_admin() OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
      WITH CHECK (public.is_admin() OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_ibge_codigos' AND policyname = 'crm_ibge_codigos_service_role_all'
  ) THEN
    CREATE POLICY crm_ibge_codigos_service_role_all
      ON public.crm_ibge_codigos
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_cnae_codigos' AND policyname = 'crm_cnae_codigos_select_auth'
  ) THEN
    CREATE POLICY crm_cnae_codigos_select_auth ON public.crm_cnae_codigos FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_cnae_codigos' AND policyname = 'crm_cnae_codigos_all_control'
  ) THEN
    CREATE POLICY crm_cnae_codigos_all_control
      ON public.crm_cnae_codigos
      FOR ALL TO authenticated
      USING (public.is_admin() OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'))
      WITH CHECK (public.is_admin() OR public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_cnae_codigos' AND policyname = 'crm_cnae_codigos_service_role_all'
  ) THEN
    CREATE POLICY crm_cnae_codigos_service_role_all
      ON public.crm_cnae_codigos
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_ibge_codigos_codigo ON public.crm_ibge_codigos(codigo_ibge);
CREATE INDEX IF NOT EXISTS idx_crm_cnae_codigos_codigo ON public.crm_cnae_codigos(codigo_cnae);

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS cliente_ibge TEXT', tbl);
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS cliente_cnae TEXT', tbl);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.conname = 'fk_clientes_ibge_codigo'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT fk_clientes_ibge_codigo FOREIGN KEY (cliente_ibge) REFERENCES public.crm_ibge_codigos(codigo_ibge) ON UPDATE CASCADE ON DELETE SET NULL',
      tbl
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.conname = 'fk_clientes_cnae_codigo'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT fk_clientes_cnae_codigo FOREIGN KEY (cliente_cnae) REFERENCES public.crm_cnae_codigos(codigo_cnae) ON UPDATE CASCADE ON DELETE SET NULL',
      tbl
    );
  END IF;

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_clientes_ibge ON %s (cliente_ibge)', tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_clientes_cnae ON %s (cliente_cnae)', tbl);
END;
$$;

COMMIT;

