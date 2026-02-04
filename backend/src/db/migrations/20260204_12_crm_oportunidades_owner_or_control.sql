BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS created_by uuid;

  UPDATE public.crm_oportunidades
     SET created_by = COALESCE(created_by, id_vendedor)
   WHERE created_by IS NULL;

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN created_by SET DEFAULT auth.uid();

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN created_by SET NOT NULL;

  ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS rbac_crm_oportunidades_select ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_insert ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_update ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_delete ON public.crm_oportunidades;

  CREATE POLICY rbac_crm_oportunidades_select
    ON public.crm_oportunidades
    FOR SELECT
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR (
        public.has_permission(auth.uid(), 'CRM', 'VIEW')
        AND created_by = auth.uid()
      )
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
      OR (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND created_by = auth.uid()
      )
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      OR (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND created_by = auth.uid()
      )
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

