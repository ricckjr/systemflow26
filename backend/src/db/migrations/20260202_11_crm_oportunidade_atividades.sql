BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidades
      DROP CONSTRAINT IF EXISTS chk_crm_oportunidades_solucao;
    ALTER TABLE public.crm_oportunidades
      ADD CONSTRAINT chk_crm_oportunidades_solucao CHECK (
        solucao IS NULL OR solucao IN ('PRODUTO','SERVICO','PRODUTO_SERVICO')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_oportunidade_atividades (
  atividade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_oport UUID NOT NULL,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    ALTER TABLE public.crm_oportunidade_atividades
      DROP CONSTRAINT IF EXISTS fk_crm_oportunidade_atividades_oportunidade;
    ALTER TABLE public.crm_oportunidade_atividades
      ADD CONSTRAINT fk_crm_oportunidade_atividades_oportunidade FOREIGN KEY (id_oport) REFERENCES public.crm_oportunidades(id_oport) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidade_atividades_id_oport_created_at
  ON public.crm_oportunidade_atividades(id_oport, created_at DESC);

ALTER TABLE public.crm_oportunidade_atividades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_atividades' AND policyname = 'rbac_crm_oportunidade_atividades_select'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_atividades_select
      ON public.crm_oportunidade_atividades FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_atividades' AND policyname = 'rbac_crm_oportunidade_atividades_insert'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_atividades_insert
      ON public.crm_oportunidade_atividades FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'EDIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_oportunidade_atividades' AND policyname = 'rbac_crm_oportunidade_atividades_service_role_all'
  ) THEN
    CREATE POLICY rbac_crm_oportunidade_atividades_service_role_all
      ON public.crm_oportunidade_atividades FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crm_log_oportunidade_atividade(_id_oport uuid, _tipo text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.crm_oportunidade_atividades (id_oport, tipo, payload)
  VALUES (_id_oport, _tipo, COALESCE(_payload, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_crm_oportunidades_log_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'CRIADA',
      jsonb_build_object(
        'id_fase', NEW.id_fase,
        'id_status', NEW.id_status,
        'solucao', NEW.solucao,
        'ticket_valor', NEW.ticket_valor,
        'temperatura', NEW.temperatura,
        'prev_entrega', NEW.prev_entrega
      )
    );
    RETURN NEW;
  END IF;

  IF NEW.id_fase IS DISTINCT FROM OLD.id_fase THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'MOVEU_KANBAN',
      jsonb_build_object('de', OLD.id_fase, 'para', NEW.id_fase)
    );
  END IF;

  IF NEW.ticket_valor IS DISTINCT FROM OLD.ticket_valor THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_VALOR',
      jsonb_build_object('de', OLD.ticket_valor, 'para', NEW.ticket_valor)
    );
  END IF;

  IF NEW.prev_entrega IS DISTINCT FROM OLD.prev_entrega THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_PREVISAO',
      jsonb_build_object('de', OLD.prev_entrega, 'para', NEW.prev_entrega)
    );
  END IF;

  IF NEW.temperatura IS DISTINCT FROM OLD.temperatura THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_TEMPERATURA',
      jsonb_build_object('de', OLD.temperatura, 'para', NEW.temperatura)
    );
  END IF;

  IF NEW.solucao IS DISTINCT FROM OLD.solucao THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_SOLUCAO',
      jsonb_build_object('de', OLD.solucao, 'para', NEW.solucao)
    );
  END IF;

  IF NEW.id_status IS DISTINCT FROM OLD.id_status THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_STATUS',
      jsonb_build_object('de', OLD.id_status, 'para', NEW.id_status)
    );
  END IF;

  IF NEW.id_motivo IS DISTINCT FROM OLD.id_motivo THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_MOTIVO',
      jsonb_build_object('de', OLD.id_motivo, 'para', NEW.id_motivo)
    );
  END IF;

  IF NEW.id_origem IS DISTINCT FROM OLD.id_origem THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_ORIGEM',
      jsonb_build_object('de', OLD.id_origem, 'para', NEW.id_origem)
    );
  END IF;

  IF NEW.id_cliente IS DISTINCT FROM OLD.id_cliente THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_CLIENTE',
      jsonb_build_object('de', OLD.id_cliente, 'para', NEW.id_cliente)
    );
  END IF;

  IF NEW.id_contato IS DISTINCT FROM OLD.id_contato THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_CONTATO',
      jsonb_build_object('de', OLD.id_contato, 'para', NEW.id_contato)
    );
  END IF;

  IF NEW.id_vendedor IS DISTINCT FROM OLD.id_vendedor THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_VENDEDOR',
      jsonb_build_object('de', OLD.id_vendedor, 'para', NEW.id_vendedor)
    );
  END IF;

  IF NEW.descricao_oport IS DISTINCT FROM OLD.descricao_oport THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_SOLICITACAO_CLIENTE',
      jsonb_build_object('de', OLD.descricao_oport, 'para', NEW.descricao_oport)
    );
  END IF;

  IF NEW.obs_oport IS DISTINCT FROM OLD.obs_oport THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ALTEROU_OBSERVACOES',
      jsonb_build_object('de', OLD.obs_oport, 'para', NEW.obs_oport)
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidades_log_atividade') THEN
      CREATE TRIGGER trg_crm_oportunidades_log_atividade
      AFTER INSERT OR UPDATE ON public.crm_oportunidades
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_crm_oportunidades_log_atividade();
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_crm_oportunidade_itens_log_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ITEM_ADICIONADO',
      jsonb_build_object(
        'tipo', NEW.tipo,
        'produto_id', NEW.produto_id,
        'servico_id', NEW.servico_id,
        'descricao', NEW.descricao_item,
        'quantidade', NEW.quantidade,
        'desconto_percent', NEW.desconto_percent,
        'valor_unitario', NEW.valor_unitario,
        'valor_total', NEW.valor_total
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.crm_log_oportunidade_atividade(
      NEW.id_oport,
      'ITEM_ATUALIZADO',
      jsonb_build_object(
        'tipo', NEW.tipo,
        'produto_id', NEW.produto_id,
        'servico_id', NEW.servico_id,
        'descricao', NEW.descricao_item,
        'de', jsonb_build_object(
          'quantidade', OLD.quantidade,
          'desconto_percent', OLD.desconto_percent,
          'valor_unitario', OLD.valor_unitario,
          'valor_total', OLD.valor_total
        ),
        'para', jsonb_build_object(
          'quantidade', NEW.quantidade,
          'desconto_percent', NEW.desconto_percent,
          'valor_unitario', NEW.valor_unitario,
          'valor_total', NEW.valor_total
        )
      )
    );
    RETURN NEW;
  ELSE
    PERFORM public.crm_log_oportunidade_atividade(
      OLD.id_oport,
      'ITEM_REMOVIDO',
      jsonb_build_object(
        'tipo', OLD.tipo,
        'produto_id', OLD.produto_id,
        'servico_id', OLD.servico_id,
        'descricao', OLD.descricao_item,
        'quantidade', OLD.quantidade,
        'desconto_percent', OLD.desconto_percent,
        'valor_unitario', OLD.valor_unitario,
        'valor_total', OLD.valor_total
      )
    );
    RETURN OLD;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidade_itens') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidade_itens_log_atividade') THEN
      CREATE TRIGGER trg_crm_oportunidade_itens_log_atividade
      AFTER INSERT OR UPDATE OR DELETE ON public.crm_oportunidade_itens
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_crm_oportunidade_itens_log_atividade();
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_crm_oportunidade_comentarios_log_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.crm_log_oportunidade_atividade(
    NEW.id_oport,
    'COMENTARIO',
    jsonb_build_object('comentario', NEW.comentario)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidade_comentarios') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_oportunidade_comentarios_log_atividade') THEN
      CREATE TRIGGER trg_crm_oportunidade_comentarios_log_atividade
      AFTER INSERT ON public.crm_oportunidade_comentarios
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_crm_oportunidade_comentarios_log_atividade();
    END IF;
  END IF;
END $$;

COMMIT;
