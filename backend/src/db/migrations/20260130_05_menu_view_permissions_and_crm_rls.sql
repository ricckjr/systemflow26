BEGIN;

INSERT INTO public.permissoes (modulo, acao, descricao)
VALUES
  ('CONFIGURACOES', 'VIEW', 'Visualizar Config Gerais')
ON CONFLICT (modulo, acao) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT pf.perfil_id, pr.permissao_id
FROM public.perfis pf
JOIN public.permissoes pr
  ON pr.modulo = 'CONFIGURACOES' AND pr.acao = 'VIEW'
WHERE pf.perfil_nome IN ('ADMINISTRADOR', 'ADMIN', 'ADMINISTRATIVO')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_select_owner_or_manage ON public.crm_oportunidades';
    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_update_owner_or_manage ON public.crm_oportunidades';
    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_service_role_all ON public.crm_oportunidades';

    EXECUTE $policy$
      CREATE POLICY crm_oportunidades_select_owner_or_manage
      ON public.crm_oportunidades
      FOR SELECT
      TO authenticated
      USING (
        id_vendedor = auth.uid()::text
        OR public.has_permission(auth.uid(), 'CRM', 'MANAGE')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY crm_oportunidades_update_owner_or_manage
      ON public.crm_oportunidades
      FOR UPDATE
      TO authenticated
      USING (
        id_vendedor = auth.uid()::text
        OR public.has_permission(auth.uid(), 'CRM', 'MANAGE')
      )
      WITH CHECK (
        id_vendedor = auth.uid()::text
        OR public.has_permission(auth.uid(), 'CRM', 'MANAGE')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY crm_oportunidades_service_role_all
      ON public.crm_oportunidades
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)
    $policy$;
  END IF;
END;
$$;

COMMIT;

