BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_oportunidade_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_oport UUID NOT NULL,
  contato_id UUID NOT NULL,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_crm_oportunidade_contatos_oport_contato'
      AND conrelid = 'public.crm_oportunidade_contatos'::regclass
  ) THEN
    ALTER TABLE public.crm_oportunidade_contatos
      ADD CONSTRAINT uq_crm_oportunidade_contatos_oport_contato UNIQUE (id_oport, contato_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_contatos
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_contatos_oportunidade;
    ALTER TABLE public.crm_oportunidade_contatos
      ADD CONSTRAINT fk_crm_oportunidade_contatos_oportunidade
      FOREIGN KEY (id_oport) REFERENCES public.crm_oportunidades(id_oport) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.crm_contatos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_contatos
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_contatos_contato;
    ALTER TABLE public.crm_oportunidade_contatos
      ADD CONSTRAINT fk_crm_oportunidade_contatos_contato
      FOREIGN KEY (contato_id) REFERENCES public.crm_contatos(contato_id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.crm_oportunidade_contatos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_contatos' AND policyname = 'rbac_crm_oportunidade_contatos_select'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_contatos_select
      ON public.crm_oportunidade_contatos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_contatos' AND policyname = 'rbac_crm_oportunidade_contatos_insert'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_contatos_insert
      ON public.crm_oportunidade_contatos FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_contatos' AND policyname = 'rbac_crm_oportunidade_contatos_update'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_contatos_update
      ON public.crm_oportunidade_contatos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_contatos' AND policyname = 'rbac_crm_oportunidade_contatos_delete'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_contatos_delete
      ON public.crm_oportunidade_contatos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_contatos' AND policyname = 'rbac_crm_oportunidade_contatos_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_contatos_service_role_all
      ON public.crm_oportunidade_contatos FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_contatos_id_oport ON public.crm_oportunidade_contatos(id_oport);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_contatos_contato_id ON public.crm_oportunidade_contatos(contato_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_oportunidade_contatos_principal_per_oport
  ON public.crm_oportunidade_contatos(id_oport)
  WHERE is_principal;

COMMIT;
