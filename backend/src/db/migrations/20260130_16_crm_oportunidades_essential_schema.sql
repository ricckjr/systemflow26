BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_oportunidade'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_oport'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN id_oportunidade TO id_oport;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='cod_oportunidade'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='cod_oport'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN cod_oportunidade TO cod_oport;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='descricao_oportunidade'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='descricao_oport'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN descricao_oportunidade TO descricao_oport;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='observacoes_vendedor'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='obs_oport'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN observacoes_vendedor TO obs_oport;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_integ'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_integ TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_cliente'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_cliente UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_contato'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_contato UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_fase'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_fase UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_status'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_status UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_motivo'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_motivo UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='id_origem'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN id_origem UUID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='solucao'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='solucao_legacy'
  ) THEN
    ALTER TABLE public.crm_oportunidades RENAME COLUMN solucao TO solucao_legacy;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='solucao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN solucao TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='qts_item'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN qts_item INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='prev_entrega'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN prev_entrega DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='temperatura'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN temperatura INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='cod_produto'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN cod_produto UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='cod_servico'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN cod_servico UUID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='valor_proposta'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='ticket_valor'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN ticket_valor NUMERIC(14,2);
    UPDATE public.crm_oportunidades
      SET ticket_valor = NULLIF(regexp_replace(valor_proposta::text, '[^0-9,\\.-]', '', 'g'), '')::numeric
      WHERE ticket_valor IS NULL AND valor_proposta IS NOT NULL AND regexp_replace(valor_proposta::text, '[^0-9,\\.-]', '', 'g') <> '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='ticket_valor'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN ticket_valor NUMERIC(14,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_lead'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_lead TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_prospeccao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_prospeccao TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_apresentacao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_apresentacao TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_qualificacao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_qualificacao TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_negociacao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_negociacao TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_conquistado'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_conquistado TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_perdidos'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_perdidos TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_posvenda'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_posvenda TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_oportunidades' AND column_name='data_alteracao'
  ) THEN
    ALTER TABLE public.crm_oportunidades ADD COLUMN data_alteracao TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crm_oportunidades_temperatura_1_100') THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT chk_crm_oportunidades_temperatura_1_100 CHECK (temperatura IS NULL OR (temperatura >= 1 AND temperatura <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crm_oportunidades_prev_entrega_month') THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT chk_crm_oportunidades_prev_entrega_month CHECK (prev_entrega IS NULL OR date_trunc('month', prev_entrega) = prev_entrega);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crm_oportunidades_solucao') THEN
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT chk_crm_oportunidades_solucao CHECK (solucao IS NULL OR solucao IN ('PRODUTO','SERVICO'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_cliente;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_cliente FOREIGN KEY (id_cliente) REFERENCES public.crm_clientes(cliente_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_contatos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_contato;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_contato FOREIGN KEY (id_contato) REFERENCES public.crm_contatos(contato_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_fase') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_fase;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_fase FOREIGN KEY (id_fase) REFERENCES public.crm_fase(fase_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_status') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_status;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_status FOREIGN KEY (id_status) REFERENCES public.crm_status(status_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_motivos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_motivo;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_motivo FOREIGN KEY (id_motivo) REFERENCES public.crm_motivos(motiv_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_origem_leads') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_origem;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_origem FOREIGN KEY (id_origem) REFERENCES public.crm_origem_leads(orig_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_produto;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_produto FOREIGN KEY (cod_produto) REFERENCES public.crm_produtos(prod_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidades_servico;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT fk_crm_oportunidades_servico FOREIGN KEY (cod_servico) REFERENCES public.crm_servicos(serv_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_touch_data_alteracao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data_alteracao := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidades_touch_data_alteracao'
  ) THEN
    CREATE TRIGGER trg_crm_oportunidades_touch_data_alteracao
    BEFORE UPDATE ON public.crm_oportunidades
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_oportunidades_touch_data_alteracao();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_set_phase_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  fase_nome text;
  norm text;
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

  IF norm LIKE '%LEAD%' AND NEW.data_lead IS NULL THEN
    NEW.data_lead := now();
  ELSIF norm LIKE '%PROSPECC%' AND NEW.data_prospeccao IS NULL THEN
    NEW.data_prospeccao := now();
  ELSIF norm LIKE '%APRESENTAC%' AND NEW.data_apresentacao IS NULL THEN
    NEW.data_apresentacao := now();
  ELSIF norm LIKE '%QUALIFICAC%' AND NEW.data_qualificacao IS NULL THEN
    NEW.data_qualificacao := now();
  ELSIF norm LIKE '%NEGOCIAC%' AND NEW.data_negociacao IS NULL THEN
    NEW.data_negociacao := now();
  ELSIF norm LIKE '%CONQUIST%' AND NEW.data_conquistado IS NULL THEN
    NEW.data_conquistado := now();
  ELSIF (norm LIKE '%PERDID%' OR norm LIKE '%PERDIDO%') AND NEW.data_perdidos IS NULL THEN
    NEW.data_perdidos := now();
  ELSIF (norm LIKE '%POS%' OR norm LIKE '%PÓS%') AND NEW.data_posvenda IS NULL THEN
    NEW.data_posvenda := now();
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

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_cliente ON public.crm_oportunidades(id_cliente);
  CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_fase ON public.crm_oportunidades(id_fase);
  CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_status ON public.crm_oportunidades(id_status);
END $$;

COMMIT;
