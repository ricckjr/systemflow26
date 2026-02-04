BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS cliente_nome text,
    ADD COLUMN IF NOT EXISTS cliente_documento text,
    ADD COLUMN IF NOT EXISTS contato_nome text,
    ADD COLUMN IF NOT EXISTS contato_cargo text,
    ADD COLUMN IF NOT EXISTS contato_telefone01 text,
    ADD COLUMN IF NOT EXISTS contato_telefone02 text,
    ADD COLUMN IF NOT EXISTS contato_email text,
    ADD COLUMN IF NOT EXISTS vendedor_nome text,
    ADD COLUMN IF NOT EXISTS vendedor_avatar_url text,
    ADD COLUMN IF NOT EXISTS data_parado timestamptz;

  ALTER TABLE public.crm_oportunidades
    ALTER COLUMN data_parado SET DEFAULT now();
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_sync_snapshot_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cliente_nome text;
  v_cliente_doc text;
  v_contato_nome text;
  v_contato_cargo text;
  v_contato_tel1 text;
  v_contato_tel2 text;
  v_contato_email text;
  v_vend_nome text;
  v_vend_avatar text;
BEGIN
  IF NEW.id_cliente IS NOT NULL AND to_regclass('public.crm_clientes') IS NOT NULL THEN
    SELECT c.cliente_nome_razao_social,
           COALESCE(c.cliente_documento_formatado, c.cliente_documento)
      INTO v_cliente_nome, v_cliente_doc
      FROM public.crm_clientes c
     WHERE c.cliente_id = NEW.id_cliente
     LIMIT 1;

    IF v_cliente_nome IS NOT NULL THEN NEW.cliente_nome := v_cliente_nome; END IF;
    IF v_cliente_doc IS NOT NULL THEN NEW.cliente_documento := v_cliente_doc; END IF;
  END IF;

  IF NEW.id_contato IS NOT NULL AND to_regclass('public.crm_contatos') IS NOT NULL THEN
    SELECT ct.contato_nome,
           ct.contato_cargo,
           ct.contato_telefone01,
           ct.contato_telefone02,
           ct.contato_email
      INTO v_contato_nome, v_contato_cargo, v_contato_tel1, v_contato_tel2, v_contato_email
      FROM public.crm_contatos ct
     WHERE ct.contato_id = NEW.id_contato
       AND ct.deleted_at IS NULL
     LIMIT 1;

    IF v_contato_nome IS NOT NULL THEN NEW.contato_nome := v_contato_nome; END IF;
    NEW.contato_cargo := v_contato_cargo;
    NEW.contato_telefone01 := v_contato_tel1;
    NEW.contato_telefone02 := v_contato_tel2;
    NEW.contato_email := v_contato_email;
  END IF;

  IF NEW.id_vendedor IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT p.nome,
           p.avatar_url
      INTO v_vend_nome, v_vend_avatar
      FROM public.profiles p
     WHERE p.id = NEW.id_vendedor
     LIMIT 1;

    IF v_vend_nome IS NOT NULL THEN NEW.vendedor_nome := v_vend_nome; END IF;
    NEW.vendedor_avatar_url := v_vend_avatar;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trg_crm_oportunidades_sync_snapshot_fields ON public.crm_oportunidades;
  CREATE TRIGGER trg_crm_oportunidades_sync_snapshot_fields
  BEFORE INSERT OR UPDATE ON public.crm_oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_oportunidades_sync_snapshot_fields();
END $$;

CREATE OR REPLACE FUNCTION public.crm_oportunidades_touch_data_alteracao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data_alteracao := now();
  NEW.data_parado := NEW.data_alteracao;
  RETURN NEW;
END;
$$;

COMMIT;

