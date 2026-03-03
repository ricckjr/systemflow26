BEGIN;

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
    patch := patch || jsonb_build_object('data_lead', now());
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
