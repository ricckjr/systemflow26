-- Migration: CRM Configs Tables
-- Description: Creates configuration tables for CRM (motivos, origens, produtos, serviços, verticais)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_motivos (
  id_motiv UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  descricao_motiv TEXT NOT NULL,
  obs_motiv TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_origem_leads (
  id_orig UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  descricao_orig TEXT NOT NULL,
  obs_orig TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_produtos (
  id_prod UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  descricao_prod TEXT NOT NULL,
  obs_prod TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_servicos (
  id_serv UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  descricao_serv TEXT NOT NULL,
  obs_serv TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_verticais (
  id_vert UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  descricao_vert TEXT NOT NULL,
  obs_ver TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_origem_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_verticais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_motivos' AND policyname = 'crm_motivos_select_auth'
  ) THEN
    CREATE POLICY crm_motivos_select_auth ON public.crm_motivos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_motivos' AND policyname = 'crm_motivos_all_auth'
  ) THEN
    CREATE POLICY crm_motivos_all_auth ON public.crm_motivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_origem_leads' AND policyname = 'crm_origem_leads_select_auth'
  ) THEN
    CREATE POLICY crm_origem_leads_select_auth ON public.crm_origem_leads FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_origem_leads' AND policyname = 'crm_origem_leads_all_auth'
  ) THEN
    CREATE POLICY crm_origem_leads_all_auth ON public.crm_origem_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_produtos' AND policyname = 'crm_produtos_select_auth'
  ) THEN
    CREATE POLICY crm_produtos_select_auth ON public.crm_produtos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_produtos' AND policyname = 'crm_produtos_all_auth'
  ) THEN
    CREATE POLICY crm_produtos_all_auth ON public.crm_produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_servicos' AND policyname = 'crm_servicos_select_auth'
  ) THEN
    CREATE POLICY crm_servicos_select_auth ON public.crm_servicos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_servicos' AND policyname = 'crm_servicos_all_auth'
  ) THEN
    CREATE POLICY crm_servicos_all_auth ON public.crm_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_verticais' AND policyname = 'crm_verticais_select_auth'
  ) THEN
    CREATE POLICY crm_verticais_select_auth ON public.crm_verticais FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_verticais' AND policyname = 'crm_verticais_all_auth'
  ) THEN
    CREATE POLICY crm_verticais_all_auth ON public.crm_verticais FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_motivos_descricao ON public.crm_motivos(descricao_motiv);
CREATE INDEX IF NOT EXISTS idx_crm_origem_leads_descricao ON public.crm_origem_leads(descricao_orig);
CREATE INDEX IF NOT EXISTS idx_crm_produtos_descricao ON public.crm_produtos(descricao_prod);
CREATE INDEX IF NOT EXISTS idx_crm_servicos_descricao ON public.crm_servicos(descricao_serv);
CREATE INDEX IF NOT EXISTS idx_crm_verticais_descricao ON public.crm_verticais(descricao_vert);

COMMIT;

