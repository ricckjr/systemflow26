BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.fin_empresas_correspondentes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS empresa_correspondente_id uuid;

  UPDATE public.crm_oportunidades o
     SET empresa_correspondente_id = e.empresa_id
    FROM public.fin_empresas_correspondentes e
   WHERE o.empresa_correspondente_id IS NULL
     AND (
       lower(btrim(o.empresa_correspondente)) = lower(btrim(e.nome_fantasia))
       OR lower(btrim(o.empresa_correspondente)) = lower(btrim(e.razao_social))
     );

  UPDATE public.crm_oportunidades o
     SET empresa_correspondente = COALESCE(NULLIF(btrim(o.empresa_correspondente), ''), 'Apliflow')
   WHERE o.empresa_correspondente IS NULL OR btrim(o.empresa_correspondente) = '';

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_empresa_correspondente;

  ALTER TABLE public.crm_oportunidades
    DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_empresa_correspondente_id;

  ALTER TABLE public.crm_oportunidades
    ADD CONSTRAINT fk_crm_oportunidades_empresa_correspondente_id
    FOREIGN KEY (empresa_correspondente_id)
    REFERENCES public.fin_empresas_correspondentes (empresa_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
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

  IF NEW.empresa_correspondente_id IS NULL THEN
    SELECT e.empresa_id
      INTO NEW.empresa_correspondente_id
      FROM public.fin_empresas_correspondentes e
     WHERE lower(btrim(COALESCE(e.nome_fantasia, ''))) = 'apliflow'
     ORDER BY e.created_at ASC
     LIMIT 1;
  END IF;

  IF NEW.data_parado IS NULL THEN
    NEW.data_parado := now();
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
