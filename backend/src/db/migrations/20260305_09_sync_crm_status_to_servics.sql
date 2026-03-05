BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.servics_equipamento') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.crm_status') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.servics_equipamento
    ADD COLUMN IF NOT EXISTS etapa_omie text;
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_sync_servics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cod text;
  v_status_desc text;
BEGIN
  v_cod := btrim(COALESCE(NEW.cod_oport, ''));
  IF v_cod = '' THEN
    BEGIN
      v_cod := btrim(COALESCE((NEW).cod_oportunidade::text, ''));
    EXCEPTION WHEN undefined_column THEN
      v_cod := '';
    END;
  END IF;

  IF v_cod = '' THEN
    RETURN NEW;
  END IF;

  SELECT btrim(COALESCE(s.status_desc, '')) INTO v_status_desc
  FROM public.crm_status s
  WHERE s.status_id = NEW.id_status;

  BEGIN
    UPDATE public.servics_equipamento se
    SET etapa_omie = NULLIF(v_status_desc, ''),
        vendedor = COALESCE(NULLIF(btrim(COALESCE(NEW.vendedor_nome, '')), ''), se.vendedor),
        empresa_correspondente = COALESCE(NULLIF(btrim(COALESCE(NEW.empresa_correspondente, '')), ''), se.empresa_correspondente),
        updated_at = now()
    WHERE btrim(COALESCE(se.cod_proposta, '')) = v_cod;
  EXCEPTION WHEN undefined_column THEN
    UPDATE public.servics_equipamento se
    SET etapa_omie = NULLIF(v_status_desc, ''),
        vendedor = COALESCE(NULLIF(btrim(COALESCE(NEW.vendedor_nome, '')), ''), se.vendedor),
        empresa_correspondente = COALESCE(NULLIF(btrim(COALESCE(NEW.empresa_correspondente, '')), ''), se.empresa_correspondente)
    WHERE btrim(COALESCE(se.cod_proposta, '')) = v_cod;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_oportunidades_sync_servics ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidades_sync_servics
AFTER INSERT OR UPDATE OF id_status, vendedor_nome, empresa_correspondente, cod_oport ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.crm_oportunidades_sync_servics();

COMMIT;

