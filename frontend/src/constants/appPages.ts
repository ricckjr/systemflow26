export type AppPage = {
  path: string
  label: string
  menu: string
  item: string
  pageModulo?: string | null
  baseModulo?: string | null
}

export const APP_PAGES: AppPage[] = [
  { path: '/app/dashboard/comercial', label: 'Dashboard Comercial', menu: 'Dashboard', item: 'Comercial', pageModulo: 'PAGINA__DASHBOARD__COMERCIAL', baseModulo: 'DASHBOARD' },

  { path: '/app/comunidade', label: 'Comunidade', menu: 'Comunidade', item: 'InstaFlow', pageModulo: 'PAGINA__COMUNIDADE__FEED', baseModulo: 'COMUNIDADE' },
  { path: '/app/comunidade/taskflow', label: 'TaskFlow', menu: 'Comunidade', item: 'TaskFlow', pageModulo: 'PAGINA__COMUNIDADE__TASKFLOW', baseModulo: 'COMUNIDADE' },
  { path: '/app/comunidade/chat', label: 'Chat Interno', menu: 'Comunidade', item: 'Chat Interno', pageModulo: 'PAGINA__COMUNIDADE__CHAT', baseModulo: 'COMUNIDADE' },
  { path: '/app/comunidade/calendario', label: 'Calendário', menu: 'Comunidade', item: 'Calendário', pageModulo: 'PAGINA__COMUNIDADE__CALENDARIO', baseModulo: 'COMUNIDADE' },

  { path: '/app/comunicacao/ia', label: 'IA Flow', menu: 'Comunidade', item: 'IA Flow', pageModulo: 'PAGINA__COMUNICACAO__IA', baseModulo: 'COMUNICACAO' },

  { path: '/app/crm/propostas-comerciais-kanban', label: 'CRM — Propostas (Kanban)', menu: 'CRM', item: 'Propostas (Kanban)', pageModulo: 'PAGINA__CRM__PROPOSTAS_COMERCIAIS_KANBAN', baseModulo: 'CRM' },
  { path: '/app/crm/proposta/:id/preview', label: 'CRM — Proposta (Preview)', menu: 'CRM', item: 'Proposta (Preview)', pageModulo: 'PAGINA__CRM__PROPOSTA_PREVIEW', baseModulo: 'CRM' },
  { path: '/app/crm/ranking', label: 'CRM — Ranking', menu: 'CRM', item: 'Ranking', pageModulo: 'PAGINA__CRM__RANKING', baseModulo: 'CRM' },
  { path: '/app/crm/clientes', label: 'CRM — Clientes', menu: 'CRM', item: 'Clientes', pageModulo: 'PAGINA__CRM__CLIENTES', baseModulo: 'CRM' },

  { path: '/app/crm/configs/origem-leads', label: 'CRM — Configs — Origem Leads', menu: 'Config Gerais', item: 'Origem Leads', pageModulo: 'PAGINA__CRM__CONFIGS__ORIGEM_LEADS', baseModulo: 'CRM' },
  { path: '/app/crm/configs/motivos', label: 'CRM — Configs — Motivos', menu: 'Config Gerais', item: 'Motivos', pageModulo: 'PAGINA__CRM__CONFIGS__MOTIVOS', baseModulo: 'CRM' },
  { path: '/app/crm/configs/verticais', label: 'CRM — Configs — Verticais', menu: 'Config Gerais', item: 'Verticais', pageModulo: 'PAGINA__CRM__CONFIGS__VERTICAIS', baseModulo: 'CRM' },
  { path: '/app/crm/configs/fases', label: 'CRM — Configs — Fases', menu: 'Config Gerais', item: 'CRM Fase', pageModulo: 'PAGINA__CRM__CONFIGS__FASES', baseModulo: 'CRM' },
  { path: '/app/crm/configs/status', label: 'CRM — Configs — Status', menu: 'Config Gerais', item: 'CRM Status', pageModulo: 'PAGINA__CRM__CONFIGS__STATUS', baseModulo: 'CRM' },

  { path: '/app/financeiro/contas-receber', label: 'Financeiro — Contas a Receber', menu: 'Financeiro', item: 'Conta a Receber', pageModulo: 'PAGINA__FINANCEIRO__CONTAS_RECEBER', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/contas-pagar', label: 'Financeiro — Contas a Pagar', menu: 'Financeiro', item: 'Conta a Pagar', pageModulo: 'PAGINA__FINANCEIRO__CONTAS_PAGAR', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/ibge', label: 'Financeiro — IBGE', menu: 'Financeiro', item: 'Cadastrar IBGE', pageModulo: 'PAGINA__FINANCEIRO__IBGE', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/cnae', label: 'Financeiro — CNAE', menu: 'Financeiro', item: 'Cadastrar CNAE', pageModulo: 'PAGINA__FINANCEIRO__CNAE', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/formas-pagamento', label: 'Financeiro — Formas de Pagamento', menu: 'Financeiro', item: 'Cadastrar Forma de Pagamento', pageModulo: 'PAGINA__FINANCEIRO__FORMAS_PAGAMENTO', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/condicoes-pagamento', label: 'Financeiro — Condições de Pagamento', menu: 'Financeiro', item: 'Cadastrar Condição de Pagamento', pageModulo: 'PAGINA__FINANCEIRO__CONDICOES_PAGAMENTO', baseModulo: 'FINANCEIRO' },
  { path: '/app/financeiro/empresas-correspondentes', label: 'Financeiro — Empresa Correspondente', menu: 'Administrativo', item: 'Empresa Correspondente', pageModulo: 'PAGINA__FINANCEIRO__EMPRESAS_CORRESPONDENTES', baseModulo: 'FINANCEIRO' },

  { path: '/app/producao/propostas', label: 'Produção — Propostas', menu: 'Produção', item: 'Propostas', pageModulo: 'PAGINA__PRODUCAO__PROPOSTAS', baseModulo: 'PRODUCAO' },
  { path: '/app/producao/ordens-servico', label: 'Produção — Ordens de Serviço', menu: 'Produção', item: 'Kanban Produção', pageModulo: 'PAGINA__PRODUCAO__ORDENS_SERVICO', baseModulo: 'PRODUCAO' },
  { path: '/app/producao/equipamentos', label: 'Produção — Equipamentos', menu: 'Produção', item: 'Equipamentos', pageModulo: 'PAGINA__PRODUCAO__EQUIPAMENTOS', baseModulo: 'PRODUCAO' },
  { path: '/app/producao/certificado-garantia', label: 'Produção — Certificado de Garantia', menu: 'Produção', item: 'Certificado garantia', pageModulo: 'PAGINA__PRODUCAO__CERTIFICADO_GARANTIA', baseModulo: 'PRODUCAO' },

  { path: '/app/frota/veiculos', label: 'Frota — Veículos', menu: 'Frota', item: 'Veículos', pageModulo: 'PAGINA__FROTA__VEICULOS', baseModulo: 'FROTA' },
  { path: '/app/frota/diario-de-bordo', label: 'Frota — Diário de Bordo', menu: 'Frota', item: 'Diário de Bordo', pageModulo: 'PAGINA__FROTA__DIARIO_BORDO', baseModulo: 'FROTA' },

  { path: '/app/smartflow/atendimentos', label: 'SmartFlow — Atendimentos', menu: 'SmartFlow', item: 'Atendimentos', pageModulo: 'PAGINA__SMARTFLOW__ATENDIMENTOS', baseModulo: 'SMARTFLOW' },
  { path: '/app/smartflow/kanban-fluxos', label: 'SmartFlow — Kanban Fluxos', menu: 'SmartFlow', item: 'Kanban de Fluxos', pageModulo: 'PAGINA__SMARTFLOW__KANBAN_FLUXOS', baseModulo: 'SMARTFLOW' },

  { path: '/app/compras-estoque/compras', label: 'Compras e Estoque — Compras', menu: 'Compras e Estoque', item: 'Compras', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__COMPRAS', baseModulo: 'COMPRAS_E_ESTOQUE' },
  { path: '/app/compras-estoque/consultar-estoque', label: 'Compras e Estoque — Consultar Estoque', menu: 'Compras e Estoque', item: 'Consultar Estoque', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__CONSULTAR_ESTOQUE', baseModulo: 'COMPRAS_E_ESTOQUE' },
  { path: '/app/compras-estoque/locais-estoque', label: 'Compras e Estoque — Locais do Estoque', menu: 'Compras e Estoque', item: 'Locais do Estoque', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__LOCAIS_ESTOQUE', baseModulo: 'COMPRAS_E_ESTOQUE' },
  { path: '/app/compras-estoque/transportadora', label: 'Compras e Estoque — Transportadora', menu: 'Compras e Estoque', item: 'Transportadora', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__TRANSPORTADORA', baseModulo: 'COMPRAS_E_ESTOQUE' },
  { path: '/app/compras-estoque/servicos', label: 'Compras e Estoque — Serviços', menu: 'Compras e Estoque', item: 'Cadastrar Serviço', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__SERVICOS', baseModulo: 'COMPRAS_E_ESTOQUE' },
  { path: '/app/compras-estoque/ncm', label: 'Compras e Estoque — NCM', menu: 'Compras e Estoque', item: 'Cadastrar NCM', pageModulo: 'PAGINA__COMPRAS_E_ESTOQUE__NCM', baseModulo: 'COMPRAS_E_ESTOQUE' },

  { path: '/app/configuracoes/perfil', label: 'Perfil', menu: 'Config Gerais', item: 'Perfil' },
  { path: '/app/configuracoes/usuarios', label: 'Config Gerais — Usuários', menu: 'Config Gerais', item: 'Usuários', pageModulo: 'PAGINA__CONFIGURACOES__USUARIOS', baseModulo: 'CONFIGURACOES' },
  { path: '/app/configuracoes/permissoes', label: 'Config Gerais — Permissões', menu: 'Config Gerais', item: 'Permissões', pageModulo: 'PAGINA__CONFIGURACOES__PERMISSOES', baseModulo: 'CONFIGURACOES' },

  { path: '/app/administrativo/colaboradores', label: 'Administrativo — Colaboradores', menu: 'Administrativo', item: 'Colaboradores', pageModulo: 'PAGINA__ADMINISTRATIVO__COLABORADORES', baseModulo: 'CONFIGURACOES' },
  { path: '/app/documentacao/empresa', label: 'Documentação — Empresa', menu: 'Administrativo', item: 'Empresa', pageModulo: 'PAGINA__DOCUMENTACAO__EMPRESA', baseModulo: 'DOCUMENTACAO' },
  { path: '/app/infra/supabase', label: 'Infra — Supabase', menu: 'Administrativo', item: 'Supabase', pageModulo: 'PAGINA__INFRA__SUPABASE', baseModulo: 'INFRA' },

  { path: '/app/universidade/catalogos', label: 'Universidade — Catálogos', menu: 'Universidade', item: 'Catálogos', pageModulo: 'PAGINA__UNIVERSIDADE__CATALOGOS', baseModulo: 'UNIVERSIDADE' },
  { path: '/app/universidade/manuais', label: 'Universidade — Manuais', menu: 'Universidade', item: 'Manuais', pageModulo: 'PAGINA__UNIVERSIDADE__MANUAIS', baseModulo: 'UNIVERSIDADE' },
  { path: '/app/universidade/treinamentos', label: 'Universidade — Treinamentos', menu: 'Universidade', item: 'Treinamentos', pageModulo: 'PAGINA__UNIVERSIDADE__TREINAMENTOS', baseModulo: 'UNIVERSIDADE' },
  { path: '/app/universidade/instrucoes-de-trabalho', label: 'Universidade — Instruções de Trabalho', menu: 'Universidade', item: 'Instruções de Trabalho', pageModulo: 'PAGINA__UNIVERSIDADE__INSTRUCOES_TRABALHO', baseModulo: 'UNIVERSIDADE' }
]

export const APP_MENUS_ORDER = [
  'Dashboard',
  'Comunidade',
  'CRM',
  'Produção',
  'Compras e Estoque',
  'Financeiro',
  'Administrativo',
  'Frota',
  'SmartFlow',
  'Universidade',
  'Config Gerais'
] as const

export const PAGE_BASE_MODULO_BY_PAGE_MODULO = Object.freeze(
  APP_PAGES.reduce((acc, p) => {
    if (p.pageModulo && p.baseModulo) acc[p.pageModulo] = p.baseModulo
    return acc
  }, {} as Record<string, string>)
)
