BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_oportunidade_itens (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_oport UUID NOT NULL,
  tipo TEXT NOT NULL,
  produto_id UUID,
  servico_id UUID,
  descricao_item TEXT,
  quantidade NUMERIC(14,2) NOT NULL DEFAULT 1,
  desconto_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.crm_oportunidade_itens
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidade_itens_tipo;
  ALTER TABLE public.crm_oportunidade_itens
    ADD CONSTRAINT chk_crm_oportunidade_itens_tipo CHECK (tipo IN ('PRODUTO','SERVICO'));
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_oportunidade_itens
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidade_itens_quantidade_gt_0;
  ALTER TABLE public.crm_oportunidade_itens
    ADD CONSTRAINT chk_crm_oportunidade_itens_quantidade_gt_0 CHECK (quantidade > 0);
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_oportunidade_itens
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidade_itens_desconto_0_100;
  ALTER TABLE public.crm_oportunidade_itens
    ADD CONSTRAINT chk_crm_oportunidade_itens_desconto_0_100 CHECK (
      desconto_percent >= 0 AND desconto_percent <= 100
    );
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_oportunidade_itens
    DROP CONSTRAINT IF EXISTS chk_crm_oportunidade_itens_valores_nonneg;
  ALTER TABLE public.crm_oportunidade_itens
    ADD CONSTRAINT chk_crm_oportunidade_itens_valores_nonneg CHECK (
      valor_unitario >= 0 AND valor_total >= 0
    );
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_itens
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_itens_oportunidade;
    ALTER TABLE public.crm_oportunidade_itens
      ADD CONSTRAINT fk_crm_oportunidade_itens_oportunidade
      FOREIGN KEY (id_oport) REFERENCES public.crm_oportunidades(id_oport) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_itens
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_itens_produto;
    ALTER TABLE public.crm_oportunidade_itens
      ADD CONSTRAINT fk_crm_oportunidade_itens_produto
      FOREIGN KEY (produto_id) REFERENCES public.crm_produtos(prod_id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_itens
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_itens_servico;
    ALTER TABLE public.crm_oportunidade_itens
      ADD CONSTRAINT fk_crm_oportunidade_itens_servico
      FOREIGN KEY (servico_id) REFERENCES public.crm_servicos(serv_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidade_itens_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidade_itens_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_crm_oportunidade_itens_touch_updated_at
    BEFORE UPDATE ON public.crm_oportunidade_itens
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_oportunidade_itens_touch_updated_at();
  END IF;
END $$;

ALTER TABLE public.crm_oportunidade_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_itens' AND policyname = 'rbac_crm_oportunidade_itens_select'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_itens_select
      ON public.crm_oportunidade_itens FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_itens' AND policyname = 'rbac_crm_oportunidade_itens_insert'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_itens_insert
      ON public.crm_oportunidade_itens FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_itens' AND policyname = 'rbac_crm_oportunidade_itens_update'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_itens_update
      ON public.crm_oportunidade_itens FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_itens' AND policyname = 'rbac_crm_oportunidade_itens_delete'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_itens_delete
      ON public.crm_oportunidade_itens FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_itens' AND policyname = 'rbac_crm_oportunidade_itens_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_itens_service_role_all
      ON public.crm_oportunidade_itens FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_itens_id_oport ON public.crm_oportunidade_itens(id_oport);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_itens_produto_id ON public.crm_oportunidade_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_itens_servico_id ON public.crm_oportunidade_itens(servico_id);

COMMIT;
