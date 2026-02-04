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

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS empresa_correspondente text;

  UPDATE public.crm_oportunidades
     SET empresa_correspondente = COALESCE(NULLIF(btrim(empresa_correspondente), ''), 'Apliflow')
   WHERE empresa_correspondente IS NULL OR btrim(empresa_correspondente) = '';

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN empresa_correspondente SET DEFAULT 'Apliflow';

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN empresa_correspondente SET NOT NULL;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_empresa_correspondente;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT chk_crm_oportunidades_empresa_correspondente
    CHECK (
      empresa_correspondente IN ('Apliflow', 'Automaflow', 'Tecnotron')
    );
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_before_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.empresa_correspondente IS NULL OR btrim(NEW.empresa_correspondente) = '' THEN
    NEW.empresa_correspondente := 'Apliflow';
  END IF;
  IF NEW.data_parado IS NULL THEN
    NEW.data_parado := now();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_before_insert_defaults ON public.crm_oportunidades;
  CREATE TRIGGER trg_crm_oportunidades_before_insert_defaults
  BEFORE INSERT ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_before_insert_defaults();
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS rbac_crm_oportunidades_select ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_insert ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_update ON public.crm_oportunidades;
  DROP POLICY IF EXISTS rbac_crm_oportunidades_delete ON public.crm_oportunidades;

  CREATE POLICY rbac_crm_oportunidades_select
    ON public.crm_oportunidades
    FOR SELECT
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'VIEW')
      AND created_by = auth.uid()
    );

  CREATE POLICY rbac_crm_oportunidades_insert
    ON public.crm_oportunidades
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (created_by IS NULL OR created_by = auth.uid())
    );

  CREATE POLICY rbac_crm_oportunidades_update
    ON public.crm_oportunidades
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND created_by = auth.uid()
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND created_by = auth.uid()
    );

  CREATE POLICY rbac_crm_oportunidades_delete
    ON public.crm_oportunidades
    FOR DELETE
    TO authenticated
    USING (
      public.has_permission(auth.uid(), 'CRM', 'CONTROL')
      AND created_by = auth.uid()
    );
END $$;

COMMIT;
