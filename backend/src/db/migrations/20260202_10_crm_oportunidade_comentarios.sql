BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_oportunidade_comentarios (
  comentario_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_oport UUID NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_comentarios
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_comentarios_oportunidade;
    ALTER TABLE public.crm_oportunidade_comentarios
      ADD CONSTRAINT fk_crm_oportunidade_comentarios_oportunidade FOREIGN KEY (id_oport) REFERENCES public.crm_oportunidades(id_oport) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.crm_oportunidade_comentarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_comentarios' AND policyname = 'rbac_crm_oportunidade_comentarios_select'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_comentarios_select
      ON public.crm_oportunidade_comentarios FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_comentarios' AND policyname = 'rbac_crm_oportunidade_comentarios_insert'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_comentarios_insert
      ON public.crm_oportunidade_comentarios FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_comentarios' AND policyname = 'rbac_crm_oportunidade_comentarios_delete'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_comentarios_delete
      ON public.crm_oportunidade_comentarios FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_comentarios' AND policyname = 'rbac_crm_oportunidade_comentarios_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_comentarios_service_role_all
      ON public.crm_oportunidade_comentarios FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_comentarios_id_oport ON public.crm_oportunidade_comentarios(id_oport);

COMMIT;
