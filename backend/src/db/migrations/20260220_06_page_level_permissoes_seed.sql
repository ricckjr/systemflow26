BEGIN;

DO $$
DECLARE
  acoes text[] := ARRAY['VIEW','EDIT','CONTROL'];
BEGIN
  IF to_regclass('public.permissoes') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissoes (modulo, acao, descricao)
  SELECT p.modulo, a, p.descricao
  FROM (
    VALUES
      ('PAGINA__DASHBOARD__COMERCIAL', 'Dashboard Comercial'),

      ('PAGINA__COMUNIDADE__FEED', 'Comunidade'),
      ('PAGINA__COMUNIDADE__TASKFLOW', 'TaskFlow'),
      ('PAGINA__COMUNIDADE__CHAT', 'Chat Interno'),
      ('PAGINA__COMUNIDADE__CALENDARIO', 'Calendário'),

      ('PAGINA__COMUNICACAO__IA', 'IA Flow'),

      ('PAGINA__CRM__PROPOSTAS_COMERCIAIS_KANBAN', 'CRM — Propostas (Kanban)'),
      ('PAGINA__CRM__PROPOSTA_PREVIEW', 'CRM — Proposta (Preview)'),
      ('PAGINA__CRM__RANKING', 'CRM — Ranking'),
      ('PAGINA__CRM__CLIENTES', 'CRM — Clientes'),
      ('PAGINA__CRM__CONFIGS__ORIGEM_LEADS', 'CRM — Configs — Origem Leads'),
      ('PAGINA__CRM__CONFIGS__MOTIVOS', 'CRM — Configs — Motivos'),
      ('PAGINA__CRM__CONFIGS__VERTICAIS', 'CRM — Configs — Verticais'),
      ('PAGINA__CRM__CONFIGS__FASES', 'CRM — Configs — Fases'),
      ('PAGINA__CRM__CONFIGS__STATUS', 'CRM — Configs — Status'),

      ('PAGINA__FINANCEIRO__CONTAS_RECEBER', 'Financeiro — Contas a Receber'),
      ('PAGINA__FINANCEIRO__CONTAS_PAGAR', 'Financeiro — Contas a Pagar'),
      ('PAGINA__FINANCEIRO__IBGE', 'Financeiro — IBGE'),
      ('PAGINA__FINANCEIRO__CNAE', 'Financeiro — CNAE'),
      ('PAGINA__FINANCEIRO__FORMAS_PAGAMENTO', 'Financeiro — Formas de Pagamento'),
      ('PAGINA__FINANCEIRO__CONDICOES_PAGAMENTO', 'Financeiro — Condições de Pagamento'),
      ('PAGINA__FINANCEIRO__EMPRESAS_CORRESPONDENTES', 'Financeiro — Empresa Correspondente'),

      ('PAGINA__PRODUCAO__PROPOSTAS', 'Produção — Propostas'),
      ('PAGINA__PRODUCAO__ORDENS_SERVICO', 'Produção — Ordens de Serviço'),
      ('PAGINA__PRODUCAO__EQUIPAMENTOS', 'Produção — Equipamentos'),
      ('PAGINA__PRODUCAO__CERTIFICADO_GARANTIA', 'Produção — Certificado de Garantia'),

      ('PAGINA__FROTA__VEICULOS', 'Frota — Veículos'),
      ('PAGINA__FROTA__DIARIO_BORDO', 'Frota — Diário de Bordo'),

      ('PAGINA__SMARTFLOW__ATENDIMENTOS', 'SmartFlow — Atendimentos'),
      ('PAGINA__SMARTFLOW__KANBAN_FLUXOS', 'SmartFlow — Kanban Fluxos'),

      ('PAGINA__COMPRAS_E_ESTOQUE__COMPRAS', 'Compras e Estoque — Compras'),
      ('PAGINA__COMPRAS_E_ESTOQUE__CONSULTAR_ESTOQUE', 'Compras e Estoque — Consultar Estoque'),
      ('PAGINA__COMPRAS_E_ESTOQUE__LOCAIS_ESTOQUE', 'Compras e Estoque — Locais do Estoque'),
      ('PAGINA__COMPRAS_E_ESTOQUE__TRANSPORTADORA', 'Compras e Estoque — Transportadora'),
      ('PAGINA__COMPRAS_E_ESTOQUE__SERVICOS', 'Compras e Estoque — Serviços'),
      ('PAGINA__COMPRAS_E_ESTOQUE__NCM', 'Compras e Estoque — NCM'),

      ('PAGINA__CONFIGURACOES__USUARIOS', 'Config Gerais — Usuários'),
      ('PAGINA__CONFIGURACOES__PERMISSOES', 'Config Gerais — Permissões'),

      ('PAGINA__ADMINISTRATIVO__COLABORADORES', 'Administrativo — Colaboradores'),
      ('PAGINA__DOCUMENTACAO__EMPRESA', 'Documentação — Empresa'),
      ('PAGINA__INFRA__SUPABASE', 'Infra — Supabase'),

      ('PAGINA__UNIVERSIDADE__CATALOGOS', 'Universidade — Catálogos'),
      ('PAGINA__UNIVERSIDADE__MANUAIS', 'Universidade — Manuais'),
      ('PAGINA__UNIVERSIDADE__TREINAMENTOS', 'Universidade — Treinamentos'),
      ('PAGINA__UNIVERSIDADE__INSTRUCOES_TRABALHO', 'Universidade — Instruções de Trabalho')
  ) AS p(modulo, descricao)
  CROSS JOIN unnest(acoes) AS a
  ON CONFLICT (modulo, acao) DO NOTHING;
END $$;

COMMIT;