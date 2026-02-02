BEGIN;

CREATE OR REPLACE FUNCTION public.is_crm_cliente_owner(p_cliente_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbl regclass;
  result boolean;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %s c WHERE c.cliente_id = $1 AND c.user_id = auth.uid() AND c.deleted_at IS NULL)',
    tbl
  )
  INTO result
  USING p_cliente_id;

  RETURN COALESCE(result, false);
END;
$$;

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN;
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS rbac_clientes_update ON %s', tbl);

  EXECUTE format(
    $p$
    CREATE POLICY rbac_clientes_update
    ON %1$s FOR UPDATE TO authenticated
    USING (
      deleted_at IS NULL
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
      )
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND (
        public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
        OR public.is_crm_cliente_owner(cliente_id)
      )
      AND (
        deleted_at IS NULL
        OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE')
      )
    )
    $p$,
    tbl
  );
END;
$$;

COMMIT;

