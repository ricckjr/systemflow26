BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_motivos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_motivos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_motivos_select_auth ON public.crm_motivos';
    EXECUTE 'DROP POLICY IF EXISTS crm_motivos_write_manage ON public.crm_motivos';
    EXECUTE 'DROP POLICY IF EXISTS crm_motivos_update_manage ON public.crm_motivos';
    EXECUTE 'DROP POLICY IF EXISTS crm_motivos_delete_manage ON public.crm_motivos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_motivos_select
      ON public.crm_motivos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_motivos_insert
      ON public.crm_motivos FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_motivos_update
      ON public.crm_motivos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_motivos_delete
      ON public.crm_motivos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_motivos_service_role_all
      ON public.crm_motivos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_origem_leads') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_origem_leads ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_origem_leads_select_auth ON public.crm_origem_leads';
    EXECUTE 'DROP POLICY IF EXISTS crm_origem_leads_write_manage ON public.crm_origem_leads';
    EXECUTE 'DROP POLICY IF EXISTS crm_origem_leads_update_manage ON public.crm_origem_leads';
    EXECUTE 'DROP POLICY IF EXISTS crm_origem_leads_delete_manage ON public.crm_origem_leads';

    EXECUTE $p$
      CREATE POLICY rbac_crm_origem_leads_select
      ON public.crm_origem_leads FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_origem_leads_insert
      ON public.crm_origem_leads FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_origem_leads_update
      ON public.crm_origem_leads FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_origem_leads_delete
      ON public.crm_origem_leads FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_origem_leads_service_role_all
      ON public.crm_origem_leads FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_produtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_produtos_select_auth ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS crm_produtos_write_manage ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS crm_produtos_update_manage ON public.crm_produtos';
    EXECUTE 'DROP POLICY IF EXISTS crm_produtos_delete_manage ON public.crm_produtos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_select
      ON public.crm_produtos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_insert
      ON public.crm_produtos FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_update
      ON public.crm_produtos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_delete
      ON public.crm_produtos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_produtos_service_role_all
      ON public.crm_produtos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_servicos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_servicos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_servicos_select_auth ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS crm_servicos_write_manage ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS crm_servicos_update_manage ON public.crm_servicos';
    EXECUTE 'DROP POLICY IF EXISTS crm_servicos_delete_manage ON public.crm_servicos';

    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_select
      ON public.crm_servicos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_insert
      ON public.crm_servicos FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_update
      ON public.crm_servicos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_delete
      ON public.crm_servicos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_servicos_service_role_all
      ON public.crm_servicos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_verticais') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_verticais ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_verticais_select_auth ON public.crm_verticais';
    EXECUTE 'DROP POLICY IF EXISTS crm_verticais_write_manage ON public.crm_verticais';
    EXECUTE 'DROP POLICY IF EXISTS crm_verticais_update_manage ON public.crm_verticais';
    EXECUTE 'DROP POLICY IF EXISTS crm_verticais_delete_manage ON public.crm_verticais';

    EXECUTE $p$
      CREATE POLICY rbac_crm_verticais_select
      ON public.crm_verticais FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_verticais_insert
      ON public.crm_verticais FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_verticais_update
      ON public.crm_verticais FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
      WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_verticais_delete
      ON public.crm_verticais FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_crm_verticais_service_role_all
      ON public.crm_verticais FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_select_owner_or_manage ON public.crm_oportunidades';
    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_update_owner_or_manage ON public.crm_oportunidades';
    EXECUTE 'DROP POLICY IF EXISTS crm_oportunidades_service_role_all ON public.crm_oportunidades';

    EXECUTE $p$
      CREATE POLICY rbac_crm_oportunidades_select
      ON public.crm_oportunidades
      FOR SELECT TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'VIEW')
        AND (
          id_vendedor = auth.uid()::text
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_oportunidades_insert
      ON public.crm_oportunidades
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR id_vendedor = auth.uid()::text
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_oportunidades_update
      ON public.crm_oportunidades
      FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          id_vendedor = auth.uid()::text
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
        )
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR id_vendedor = auth.uid()::text
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_oportunidades_delete
      ON public.crm_oportunidades
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_crm_oportunidades_service_role_all
      ON public.crm_oportunidades
      FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS clientes_select_final ON public.clientes';
    EXECUTE 'DROP POLICY IF EXISTS clientes_insert_final ON public.clientes';
    EXECUTE 'DROP POLICY IF EXISTS clientes_update_final ON public.clientes';

    EXECUTE $p$
      CREATE POLICY rbac_clientes_select
      ON public.clientes FOR SELECT TO authenticated
      USING (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'VIEW')
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_insert
      ON public.clientes FOR INSERT TO authenticated
      WITH CHECK (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_update
      ON public.clientes FOR UPDATE TO authenticated
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
          user_id = auth.uid()
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
        )
        AND (
          deleted_at IS NULL
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE')
        )
      )
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.clientes_contatos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_select_final ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_insert_final ON public.clientes_contatos';
    EXECUTE 'DROP POLICY IF EXISTS clientes_contatos_update_final ON public.clientes_contatos';

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_select
      ON public.clientes_contatos FOR SELECT TO authenticated
      USING (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'VIEW')
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND (
              c.user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
              OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
            )
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_insert
      ON public.clientes_contatos FOR INSERT TO authenticated
      WITH CHECK (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR (
            user_id = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM public.clientes c
              WHERE c.cliente_id = clientes_contatos.cliente_id
                AND c.deleted_at IS NULL
                AND c.user_id = auth.uid()
            )
          )
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_clientes_contatos_update
      ON public.clientes_contatos FOR UPDATE TO authenticated
      USING (
        deleted_at IS NULL
        AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND (
              c.user_id = auth.uid()
              OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
              OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
            )
        )
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'CRM', 'EDIT')
        AND (
          public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'MANAGE')
          OR EXISTS (
            SELECT 1
            FROM public.clientes c
            WHERE c.cliente_id = clientes_contatos.cliente_id
              AND c.deleted_at IS NULL
              AND c.user_id = auth.uid()
          )
        )
        AND (
          deleted_at IS NULL
          OR public.has_permission(auth.uid(), 'CRM', 'CONTROL')
          OR public.has_permission(auth.uid(), 'CLIENTES', 'DELETE')
        )
      )
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.crm_meta_comercial') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_meta_comercial ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS dashboard_meta_select_auth ON public.crm_meta_comercial';
    EXECUTE 'DROP POLICY IF EXISTS dashboard_meta_write_auth ON public.crm_meta_comercial';
    EXECUTE 'DROP POLICY IF EXISTS dashboard_meta_update_auth ON public.crm_meta_comercial';
    EXECUTE 'DROP POLICY IF EXISTS dashboard_meta_delete_auth ON public.crm_meta_comercial';

    EXECUTE $p$
      CREATE POLICY rbac_dashboard_meta_select
      ON public.crm_meta_comercial FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'DASHBOARD', 'VIEW'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_dashboard_meta_insert
      ON public.crm_meta_comercial FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'DASHBOARD', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_dashboard_meta_update
      ON public.crm_meta_comercial FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'DASHBOARD', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'DASHBOARD', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_dashboard_meta_delete
      ON public.crm_meta_comercial FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'DASHBOARD', 'CONTROL'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_dashboard_meta_service_role_all
      ON public.crm_meta_comercial FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.universidade_catalogos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.universidade_catalogos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Todos podem ver catálogos" ON public.universidade_catalogos';
    EXECUTE 'DROP POLICY IF EXISTS "Usuários autenticados podem criar catálogos" ON public.universidade_catalogos';
    EXECUTE 'DROP POLICY IF EXISTS "Criadores podem atualizar seus catálogos" ON public.universidade_catalogos';
    EXECUTE 'DROP POLICY IF EXISTS "Criadores podem deletar seus catálogos" ON public.universidade_catalogos';

    EXECUTE $p$
      CREATE POLICY rbac_universidade_catalogos_select
      ON public.universidade_catalogos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'UNIVERSIDADE', 'VIEW'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_universidade_catalogos_insert
      ON public.universidade_catalogos FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'UNIVERSIDADE', 'EDIT')
        AND (created_by IS NULL OR created_by = auth.uid())
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_universidade_catalogos_update
      ON public.universidade_catalogos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'UNIVERSIDADE', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'UNIVERSIDADE', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_universidade_catalogos_delete
      ON public.universidade_catalogos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'UNIVERSIDADE', 'CONTROL'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_universidade_catalogos_service_role_all
      ON public.universidade_catalogos FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.servics_equipamento') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.servics_equipamento ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS producao_servics_select ON public.servics_equipamento';
    EXECUTE 'DROP POLICY IF EXISTS producao_servics_insert ON public.servics_equipamento';
    EXECUTE 'DROP POLICY IF EXISTS producao_servics_update ON public.servics_equipamento';
    EXECUTE 'DROP POLICY IF EXISTS producao_servics_delete ON public.servics_equipamento';

    EXECUTE $p$
      CREATE POLICY rbac_producao_servics_select
      ON public.servics_equipamento FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'VIEW'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_servics_insert
      ON public.servics_equipamento FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_servics_update
      ON public.servics_equipamento FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_servics_delete
      ON public.servics_equipamento FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'CONTROL'))
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.servics_historico') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.servics_historico ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS producao_historico_select ON public.servics_historico';
    EXECUTE 'DROP POLICY IF EXISTS producao_historico_insert ON public.servics_historico';
    EXECUTE 'DROP POLICY IF EXISTS producao_historico_update ON public.servics_historico';
    EXECUTE 'DROP POLICY IF EXISTS producao_historico_delete ON public.servics_historico';

    EXECUTE $p$
      CREATE POLICY rbac_producao_historico_select
      ON public.servics_historico FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'VIEW'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_historico_insert
      ON public.servics_historico FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_historico_update
      ON public.servics_historico FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_historico_delete
      ON public.servics_historico FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'CONTROL'))
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.omie_servics') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.omie_servics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS producao_omie_select ON public.omie_servics';
    EXECUTE 'DROP POLICY IF EXISTS producao_omie_insert ON public.omie_servics';
    EXECUTE 'DROP POLICY IF EXISTS producao_omie_update ON public.omie_servics';
    EXECUTE 'DROP POLICY IF EXISTS producao_omie_delete ON public.omie_servics';

    EXECUTE $p$
      CREATE POLICY rbac_producao_omie_select
      ON public.omie_servics FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'VIEW'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_omie_insert
      ON public.omie_servics FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_omie_update
      ON public.omie_servics FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'PRODUCAO', 'EDIT'))
    $p$;

    EXECUTE $p$
      CREATE POLICY rbac_producao_omie_delete
      ON public.omie_servics FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'PRODUCAO', 'CONTROL'))
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.frota_veiculos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.frota_veiculos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS frota_veiculos_select ON public.frota_veiculos';
    EXECUTE 'DROP POLICY IF EXISTS frota_veiculos_insert ON public.frota_veiculos';
    EXECUTE 'DROP POLICY IF EXISTS frota_veiculos_update ON public.frota_veiculos';
    EXECUTE 'DROP POLICY IF EXISTS frota_veiculos_delete ON public.frota_veiculos';

    EXECUTE $p$
      CREATE POLICY rbac_frota_veiculos_select
      ON public.frota_veiculos FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_veiculos_insert
      ON public.frota_veiculos FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_veiculos_update
      ON public.frota_veiculos FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_veiculos_delete
      ON public.frota_veiculos FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'CONTROL'))
    $p$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.frota_diario_bordo') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.frota_diario_bordo ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS frota_diario_select ON public.frota_diario_bordo';
    EXECUTE 'DROP POLICY IF EXISTS frota_diario_insert ON public.frota_diario_bordo';
    EXECUTE 'DROP POLICY IF EXISTS frota_diario_update ON public.frota_diario_bordo';
    EXECUTE 'DROP POLICY IF EXISTS frota_diario_delete ON public.frota_diario_bordo';

    EXECUTE $p$
      CREATE POLICY rbac_frota_diario_select
      ON public.frota_diario_bordo FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'VIEW'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_diario_insert
      ON public.frota_diario_bordo FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_diario_update
      ON public.frota_diario_bordo FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
      WITH CHECK (public.has_permission(auth.uid(), 'FROTA', 'EDIT'))
    $p$;
    EXECUTE $p$
      CREATE POLICY rbac_frota_diario_delete
      ON public.frota_diario_bordo FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'FROTA', 'CONTROL'))
    $p$;
  END IF;
END;
$$;

COMMIT;
