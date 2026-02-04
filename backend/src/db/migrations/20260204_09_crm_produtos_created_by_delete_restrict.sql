DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    ALTER TABLE public.crm_produtos
      ADD COLUMN IF NOT EXISTS created_by uuid;

    ALTER TABLE public.crm_produtos
      ALTER COLUMN created_by SET DEFAULT auth.uid();

    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_insert ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS rbac_crm_produtos_delete ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_insert
      ON public.crm_produtos FOR INSERT TO authenticated
      WITH CHECK (
        (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
        )
        AND created_by = auth.uid()
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_delete
      ON public.crm_produtos FOR DELETE TO authenticated
      USING (
        (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'COMPRAS_E_ESTOQUE', 'CONTROL')
        )
        AND (
          public.has_permission(auth.uid(), 'CONFIGURACOES', 'CONTROL')
          OR created_by = auth.uid()
        )
      )
    $p$;
  END IF;
END;
$$;

