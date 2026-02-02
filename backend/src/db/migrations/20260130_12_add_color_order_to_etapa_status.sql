BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_etapa') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_etapa' AND column_name = 'etapa_ordem'
    ) THEN
      ALTER TABLE public.crm_etapa ADD COLUMN etapa_ordem INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_etapa' AND column_name = 'etapa_cor'
    ) THEN
      ALTER TABLE public.crm_etapa ADD COLUMN etapa_cor TEXT;
    END IF;

    UPDATE public.crm_etapa
    SET etapa_ordem = CASE etapa_desc
      WHEN 'Lead' THEN 10
      WHEN 'Prospecção' THEN 20
      WHEN 'Apresentação' THEN 30
      WHEN 'Qualificação' THEN 40
      WHEN 'Negociação' THEN 50
      WHEN 'Conquistado' THEN 60
      WHEN 'Perdidos' THEN 70
      WHEN 'Pós-Venda' THEN 80
      ELSE 999
    END
    WHERE etapa_ordem IS NULL;

    UPDATE public.crm_etapa
    SET etapa_cor = CASE etapa_desc
      WHEN 'Lead' THEN '#94a3b8'
      WHEN 'Prospecção' THEN '#60a5fa'
      WHEN 'Apresentação' THEN '#818cf8'
      WHEN 'Qualificação' THEN '#a78bfa'
      WHEN 'Negociação' THEN '#fbbf24'
      WHEN 'Conquistado' THEN '#34d399'
      WHEN 'Perdidos' THEN '#fb7185'
      WHEN 'Pós-Venda' THEN '#22d3ee'
      ELSE '#94a3b8'
    END
    WHERE etapa_cor IS NULL;

    EXECUTE 'ALTER TABLE public.crm_etapa ALTER COLUMN etapa_ordem SET DEFAULT 0';
    UPDATE public.crm_etapa SET etapa_ordem = 0 WHERE etapa_ordem IS NULL;
    EXECUTE 'ALTER TABLE public.crm_etapa ALTER COLUMN etapa_ordem SET NOT NULL';

    CREATE INDEX IF NOT EXISTS idx_crm_etapa_ordem ON public.crm_etapa(etapa_ordem);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_status') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_status' AND column_name = 'status_ordem'
    ) THEN
      ALTER TABLE public.crm_status ADD COLUMN status_ordem INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_status' AND column_name = 'status_cor'
    ) THEN
      ALTER TABLE public.crm_status ADD COLUMN status_cor TEXT;
    END IF;

    UPDATE public.crm_status
    SET status_ordem = 0
    WHERE status_ordem IS NULL;

    EXECUTE 'ALTER TABLE public.crm_status ALTER COLUMN status_ordem SET DEFAULT 0';
    EXECUTE 'ALTER TABLE public.crm_status ALTER COLUMN status_ordem SET NOT NULL';

    CREATE INDEX IF NOT EXISTS idx_crm_status_ordem ON public.crm_status(status_ordem);
  END IF;
END $$;

COMMIT;

