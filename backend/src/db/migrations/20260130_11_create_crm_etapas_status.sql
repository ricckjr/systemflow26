BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_etapa (
  etapa_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integ_id TEXT UNIQUE,
  etapa_desc TEXT NOT NULL,
  etapa_obs TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_status (
  status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integ_id TEXT UNIQUE,
  status_desc TEXT NOT NULL,
  status_obs TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_etapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_etapa' AND policyname = 'rbac_crm_etapa_select'
  ) THEN
    CREATE POLICY rbac_crm_etapa_select
      ON public.crm_etapa FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_etapa' AND policyname = 'rbac_crm_etapa_insert'
  ) THEN
    CREATE POLICY rbac_crm_etapa_insert
      ON public.crm_etapa FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_etapa' AND policyname = 'rbac_crm_etapa_update'
  ) THEN
    CREATE POLICY rbac_crm_etapa_update
      ON public.crm_etapa FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_etapa' AND policyname = 'rbac_crm_etapa_delete'
  ) THEN
    CREATE POLICY rbac_crm_etapa_delete
      ON public.crm_etapa FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_etapa' AND policyname = 'rbac_crm_etapa_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_etapa_service_role_all
      ON public.crm_etapa FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_status' AND policyname = 'rbac_crm_status_select'
  ) THEN
    CREATE POLICY rbac_crm_status_select
      ON public.crm_status FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_status' AND policyname = 'rbac_crm_status_insert'
  ) THEN
    CREATE POLICY rbac_crm_status_insert
      ON public.crm_status FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_status' AND policyname = 'rbac_crm_status_update'
  ) THEN
    CREATE POLICY rbac_crm_status_update
      ON public.crm_status FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_status' AND policyname = 'rbac_crm_status_delete'
  ) THEN
    CREATE POLICY rbac_crm_status_delete
      ON public.crm_status FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_status' AND policyname = 'rbac_crm_status_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_status_service_role_all
      ON public.crm_status FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.crm_etapa (etapa_desc, etapa_obs)
SELECT v.etapa_desc, v.etapa_obs
FROM (
  VALUES
    ('Lead', NULL),
    ('Prospecção', NULL),
    ('Apresentação', NULL),
    ('Qualificação', NULL),
    ('Negociação', NULL),
    ('Conquistado', NULL),
    ('Perdidos', NULL),
    ('Pós-Venda', NULL)
) AS v(etapa_desc, etapa_obs)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_etapa);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_etapa_desc ON public.crm_etapa(etapa_desc);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_status_desc ON public.crm_status(status_desc);

CREATE INDEX IF NOT EXISTS idx_crm_etapa_desc ON public.crm_etapa(etapa_desc);
CREATE INDEX IF NOT EXISTS idx_crm_status_desc ON public.crm_status(status_desc);

COMMIT;
