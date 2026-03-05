BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS data_lead timestamptz;

  UPDATE public.crm_oportunidades
     SET data_lead = data_inclusao
   WHERE data_lead IS NULL AND data_inclusao IS NOT NULL;
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
  IF NEW.data_lead IS NULL THEN
    NEW.data_lead := COALESCE(NEW.data_inclusao, now());
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

CREATE OR REPLACE FUNCTION public.crm_oportunidades_set_phase_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fase_nome text;
  norm text;
  patch jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id_fase IS NOT DISTINCT FROM OLD.id_fase THEN
    RETURN NEW;
  END IF;

  IF NEW.id_fase IS NULL OR to_regclass('public.crm_fase') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fase_desc INTO fase_nome
  FROM public.crm_fase
  WHERE fase_id = NEW.id_fase;

  norm := upper(coalesce(fase_nome, ''));
  norm := translate(norm, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC');

  IF norm LIKE '%LEAD%' THEN
    patch := patch || jsonb_build_object('data_lead', COALESCE(NEW.data_inclusao, now()));
  ELSIF norm LIKE '%PROSPECC%' THEN
    patch := patch || jsonb_build_object('data_prospeccao', now());
  ELSIF norm LIKE '%APRESENTAC%' THEN
    patch := patch || jsonb_build_object('data_apresentacao', now());
  ELSIF norm LIKE '%QUALIFICAC%' THEN
    patch := patch || jsonb_build_object('data_qualificacao', now());
  ELSIF norm LIKE '%NEGOCIAC%' THEN
    patch := patch || jsonb_build_object('data_negociacao', now());
  ELSIF norm LIKE '%CONQUIST%' THEN
    patch := patch || jsonb_build_object('data_conquistado', now());
  ELSIF (norm LIKE '%PERDID%' OR norm LIKE '%PERDIDO%') THEN
    patch := patch || jsonb_build_object('data_perdidos', now());
  ELSIF (norm LIKE '%POS%' OR norm LIKE '%PÓS%') THEN
    patch := patch || jsonb_build_object('data_posvenda', now());
  END IF;

  IF patch <> '{}'::jsonb THEN
    NEW := jsonb_populate_record(NEW, patch);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_set_phase_date ON public.crm_oportunidades;
  CREATE TRIGGER trg_crm_oportunidades_set_phase_date
  BEFORE INSERT OR UPDATE OF id_fase ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_set_phase_date();
END $$;

COMMIT;

