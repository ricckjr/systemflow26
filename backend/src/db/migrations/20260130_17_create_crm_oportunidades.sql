BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id_oport UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_integ TEXT UNIQUE,
  cod_oport TEXT,

  id_vendedor UUID,
  id_cliente UUID,
  id_contato UUID,
  id_fase UUID,
  id_status UUID,
  id_motivo UUID,
  id_origem UUID,

  solucao TEXT,
  obs_oport TEXT,
  descricao_oport TEXT,
  qts_item INTEGER,
  prev_entrega DATE,
  temperatura INTEGER,
  cod_produto UUID,
  cod_servico UUID,
  ticket_valor NUMERIC(14,2),

  data_lead TIMESTAMPTZ,
  data_prospeccao TIMESTAMPTZ,
  data_apresentacao TIMESTAMPTZ,
  data_qualificacao TIMESTAMPTZ,
  data_negociacao TIMESTAMPTZ,
  data_conquistado TIMESTAMPTZ,
  data_perdidos TIMESTAMPTZ,
  data_posvenda TIMESTAMPTZ,

  data_inclusao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_alteracao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT IF NOT EXISTS chk_crm_oportunidades_temperatura_1_100 CHECK (temperatura IS NULL OR (temperatura >= 1 AND temperatura <= 100));

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT IF NOT EXISTS chk_crm_oportunidades_prev_entrega_month CHECK (prev_entrega IS NULL OR date_trunc('month', prev_entrega) = prev_entrega);

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT IF NOT EXISTS chk_crm_oportunidades_solucao CHECK (solucao IS NULL OR solucao IN ('PRODUTO','SERVICO'));

DO $$
BEGIN
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidades_touch_data_alteracao'
  ) THEN
    CREATE TRIGGER trg_crm_oportunidades_touch_data_alteracao
    BEFORE UPDATE ON public.crm_oportunidades
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_oportunidades_touch_data_alteracao();
  END IF;
END $$;

ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'rbac_crm_oportunidades_select'
  ) THEN
    CREATE POLICY rbac_crm_oportunidades_select
      ON public.crm_oportunidades FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'rbac_crm_oportunidades_insert'
  ) THEN
    CREATE POLICY rbac_crm_oportunidades_insert
      ON public.crm_oportunidades FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'rbac_crm_oportunidades_update'
  ) THEN
    CREATE POLICY rbac_crm_oportunidades_update
      ON public.crm_oportunidades FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'rbac_crm_oportunidades_delete'
  ) THEN
    CREATE POLICY rbac_crm_oportunidades_delete
      ON public.crm_oportunidades FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidades' AND policyname = 'rbac_crm_oportunidades_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_oportunidades_service_role_all
      ON public.crm_oportunidades FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_cliente ON public.crm_oportunidades(id_cliente);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_fase ON public.crm_oportunidades(id_fase);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_id_status ON public.crm_oportunidades(id_status);

COMMIT;

