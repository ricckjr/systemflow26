BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='contato_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_contato'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN contato_id TO id_contato;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='orig_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_origem'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN orig_id TO id_origem;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_contato'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_contato uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_origem'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_origem uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.crm_contatos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_contato;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_contato
      FOREIGN KEY (id_contato) REFERENCES public.crm_contatos(contato_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_origem_leads') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_origem;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_origem
      FOREIGN KEY (id_origem) REFERENCES public.crm_origem_leads(orig_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_contato ON public.crm_oportunidades(id_contato);
  CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_origem ON public.crm_oportunidades(id_origem);
END $$;

COMMIT;
