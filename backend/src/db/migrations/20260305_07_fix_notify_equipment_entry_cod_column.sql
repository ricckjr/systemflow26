BEGIN;

DO $$
BEGIN
  IF to_regclass('public.servics_equipamento') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_equipment_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_id uuid;
  v_status_id text;
  v_cod text;
  v_email text;
  v_nome text;
  has_cod_oport boolean;
  has_cod_oportunidade boolean;
  has_data_alteracao boolean;
  sql_text text;
BEGIN
  v_cod := btrim(COALESCE(NEW.cod_proposta, ''));
  v_email := btrim(COALESCE(NEW.email_vendedor, ''));
  v_nome := btrim(COALESCE(NEW.vendedor, ''));

  IF v_email <> '' THEN
    SELECT p.id INTO v_vendor_id
    FROM public.profiles p
    WHERE p.email_login = v_email OR p.email_corporativo = v_email
    LIMIT 1;
  END IF;

  IF v_vendor_id IS NULL AND v_nome <> '' THEN
    SELECT p.id INTO v_vendor_id
    FROM public.profiles p
    WHERE p.nome = v_nome
    LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'cod_oport'
  ) INTO has_cod_oport;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'cod_oportunidade'
  ) INTO has_cod_oportunidade;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_oportunidades' AND column_name = 'data_alteracao'
  ) INTO has_data_alteracao;

  IF v_cod <> '' AND to_regclass('public.crm_oportunidades') IS NOT NULL AND to_regclass('public.crm_status') IS NOT NULL THEN
    SELECT s.status_id INTO v_status_id
    FROM public.crm_status s
    WHERE upper(btrim(COALESCE(s.status_desc, ''))) IN ('ANÁLISE TÉCNICA', 'ANALISE TECNICA')
    ORDER BY s.status_ordem NULLS LAST, s.status_desc
    LIMIT 1;

    IF v_status_id IS NOT NULL THEN
      IF has_cod_oport OR has_cod_oportunidade THEN
        sql_text :=
          'UPDATE public.crm_oportunidades o SET id_status = $1' ||
          CASE WHEN has_data_alteracao THEN ', data_alteracao = now()' ELSE '' END ||
          ' WHERE ' ||
          CASE WHEN has_cod_oport THEN 'o.cod_oport = $2' ELSE 'o.cod_oportunidade = $2' END ||
          ' AND o.id_status IS DISTINCT FROM $1';
        EXECUTE sql_text USING v_status_id, v_cod;
      END IF;
    END IF;
  END IF;

  IF v_vendor_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, content, link, type, is_read)
    VALUES (
      v_vendor_id,
      'Equipamento em Produção',
      'Entrada de equipamento registrada.' ||
      CASE WHEN v_cod <> '' THEN E'\nProposta: ' || v_cod ELSE '' END ||
      CASE WHEN btrim(COALESCE(NEW.cliente, '')) <> '' THEN E'\nCliente: ' || btrim(NEW.cliente) ELSE '' END ||
      CASE WHEN btrim(COALESCE(NEW.id_rst, '')) <> '' THEN E'\nID RST: ' || btrim(NEW.id_rst) ELSE '' END ||
      CASE WHEN btrim(COALESCE(NEW.modelo, '')) <> '' THEN E'\nModelo: ' || btrim(NEW.modelo) ELSE '' END,
      '/app/producao/logistica',
      'info',
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servics_equipamento_notify_entry ON public.servics_equipamento;
CREATE TRIGGER servics_equipamento_notify_entry
AFTER INSERT ON public.servics_equipamento
FOR EACH ROW EXECUTE FUNCTION public.notify_equipment_entry();

COMMIT;

