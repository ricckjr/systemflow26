BEGIN;

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
  old_cliente uuid;
  old_contato uuid;
  old_vendedor uuid;
BEGIN
  old_cliente := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_cliente ELSE NULL END;
  old_contato := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_contato ELSE NULL END;
  old_vendedor := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_vendedor ELSE NULL END;

  IF NEW.id_cliente IS NOT NULL
     AND to_regclass('public.crm_clientes') IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.id_cliente IS DISTINCT FROM old_cliente
       OR NULLIF(btrim(COALESCE(NEW.cliente_nome, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.cliente_documento, '')), '') IS NULL
     )
  THEN
    SELECT c.cliente_nome_razao_social,
           COALESCE(c.cliente_documento_formatado, c.cliente_documento)
      INTO v_cliente_nome, v_cliente_doc
      FROM public.crm_clientes c
     WHERE c.cliente_id = NEW.id_cliente
     LIMIT 1;

    IF NULLIF(btrim(COALESCE(NEW.cliente_nome, '')), '') IS NULL AND v_cliente_nome IS NOT NULL THEN
      NEW.cliente_nome := v_cliente_nome;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.cliente_documento, '')), '') IS NULL AND v_cliente_doc IS NOT NULL THEN
      NEW.cliente_documento := v_cliente_doc;
    END IF;
  END IF;

  IF NEW.id_contato IS NOT NULL
     AND to_regclass('public.crm_contatos') IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.id_contato IS DISTINCT FROM old_contato
       OR NULLIF(btrim(COALESCE(NEW.contato_nome, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.contato_cargo, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.contato_telefone01, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.contato_telefone02, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.contato_email, '')), '') IS NULL
     )
  THEN
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

    IF NULLIF(btrim(COALESCE(NEW.contato_nome, '')), '') IS NULL AND v_contato_nome IS NOT NULL THEN
      NEW.contato_nome := v_contato_nome;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.contato_cargo, '')), '') IS NULL THEN
      NEW.contato_cargo := v_contato_cargo;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.contato_telefone01, '')), '') IS NULL THEN
      NEW.contato_telefone01 := v_contato_tel1;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.contato_telefone02, '')), '') IS NULL THEN
      NEW.contato_telefone02 := v_contato_tel2;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.contato_email, '')), '') IS NULL THEN
      NEW.contato_email := v_contato_email;
    END IF;
  END IF;

  IF NEW.id_vendedor IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.id_vendedor IS DISTINCT FROM old_vendedor
       OR NULLIF(btrim(COALESCE(NEW.vendedor_nome, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.vendedor_avatar_url, '')), '') IS NULL
     )
  THEN
    SELECT p.nome,
           p.avatar_url
      INTO v_vend_nome, v_vend_avatar
      FROM public.profiles p
     WHERE p.id = NEW.id_vendedor
     LIMIT 1;

    IF NULLIF(btrim(COALESCE(NEW.vendedor_nome, '')), '') IS NULL AND v_vend_nome IS NOT NULL THEN
      NEW.vendedor_nome := v_vend_nome;
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.vendedor_avatar_url, '')), '') IS NULL THEN
      NEW.vendedor_avatar_url := v_vend_avatar;
    END IF;
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

COMMIT;
