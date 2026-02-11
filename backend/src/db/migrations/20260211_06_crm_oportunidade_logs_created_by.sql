BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidade_comentarios') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_comentarios
      ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();

    CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_comentarios_created_by
      ON public.crm_oportunidade_comentarios(created_by);
  END IF;

  IF to_regclass('public.crm_oportunidade_atividades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_atividades
      ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();

    CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_atividades_created_by
      ON public.crm_oportunidade_atividades(created_by);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_log_oportunidade_atividade(_id_oport uuid, _tipo text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.crm_oportunidade_atividades (id_oport, tipo, payload, created_by)
  VALUES (_id_oport, _tipo, COALESCE(_payload, '{}'::jsonb), auth.uid());
END;
$$;

COMMIT;

