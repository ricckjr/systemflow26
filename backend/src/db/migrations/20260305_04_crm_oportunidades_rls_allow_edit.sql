BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_oportunidades'
      AND policyname LIKE 'rbac_crm_oportunidades_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_oportunidades', r.policyname);
  END LOOP;

  CREATE POLICY rbac_crm_oportunidades_select
    ON public.crm_oportunidades
    FOR SELECT
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR public.has_permission(auth.uid(), 'CRM', 'VIEW')
      OR public.has_permission(auth.uid(), 'CRM', 'EDIT')
    );

  CREATE POLICY rbac_crm_oportunidades_insert
    ON public.crm_oportunidades
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (created_by IS NULL OR created_by = auth.uid())
      )
    );

  CREATE POLICY rbac_crm_oportunidades_update
    ON public.crm_oportunidades
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR public.has_permission(auth.uid(), 'CRM', 'EDIT')
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR public.has_permission(auth.uid(), 'CRM', 'EDIT')
    );

  CREATE POLICY rbac_crm_oportunidades_delete
    ON public.crm_oportunidades
    FOR DELETE
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
    );
END $$;

COMMIT;

