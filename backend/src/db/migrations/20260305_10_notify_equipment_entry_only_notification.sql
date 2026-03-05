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
  v_cod text;
  v_email text;
  v_nome text;
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

