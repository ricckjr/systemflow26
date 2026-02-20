import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './guards/ProtectedRoute'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthCallback from '@/pages/AuthCallback'
import RequirePermission from './guards/RequirePermission'
import ProtectedNoLayoutRoute from './guards/ProtectedNoLayoutRoute'

// Auth Pages
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'

// ==============================
// Loader
// ==============================
const Loader = ({ text = 'Carregando...' }: { text?: string }) => (
  <div className="p-6 text-center text-sm text-blue-400">{text}</div>
)

// ==============================
// Helper
// ==============================
const lazyPage = (element: React.ReactNode, text?: string) => (
  <Suspense fallback={<Loader text={text} />}>
    <ErrorBoundary>{element}</ErrorBoundary>
  </Suspense>
)

type LazyImporter = () => Promise<{ default: React.ComponentType<any> }>

const lazyElement = (
  importer: LazyImporter,
  text?: string,
  wrap?: (node: React.ReactNode) => React.ReactNode
) => {
  const Component = lazy(importer)
  const element = <Component />
  return lazyPage(wrap ? wrap(element) : element, text)
}

// ==============================
// Router
// ==============================
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },

  // Auth
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/reset', element: <Navigate to="/forgot-password" replace /> },

  {
    path: '/crm/proposta/:id/preview',
    element: (
      <ProtectedNoLayoutRoute>
        {lazyElement(
          () => import('@/pages/CRM/PropostaPreview'),
          'Carregando Proposta...',
          (node) => <RequirePermission modulo="PAGINA__CRM__PROPOSTA_PREVIEW" acao="VIEW" fallbackTo="/app/crm/propostas-comerciais-kanban">{node}</RequirePermission>
        )}
      </ProtectedNoLayoutRoute>
    )
  },

  // =========================
  // APP (Protected)
  // =========================
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard/comercial" replace /> },

      {
        path: 'comunidade',
        element: lazyElement(
          () => import('@/pages/Comunidade/InstaFlow'),
          'Carregando InstaFlow...',
          (node) => <RequirePermission modulo="PAGINA__COMUNIDADE__FEED" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'comunidade/taskflow',
        element: lazyElement(
          () => import('@/pages/Comunidade/TaskFlow'),
          'Carregando TaskFlow...',
          (node) => <RequirePermission modulo="PAGINA__COMUNIDADE__TASKFLOW" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'comunidade/chat',
        element: lazyElement(
          () => import('@/pages/Comunicacao/ChatInterno'),
          'Carregando Chat...',
          (node) => <RequirePermission modulo="PAGINA__COMUNIDADE__CHAT" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'comunidade/calendario',
        element: lazyElement(
          () => import('@/pages/Comunidade/Calendario'),
          'Carregando Calendário...',
          (node) => <RequirePermission modulo="PAGINA__COMUNIDADE__CALENDARIO" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'dashboard/comercial',
        element: lazyElement(
          () => import('@/pages/dashboard/VisaoGeral'),
          'Carregando Comercial...',
          (node) => <RequirePermission modulo="PAGINA__DASHBOARD__COMERCIAL" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'crm/propostas-comerciais-kanban',
        element: lazyElement(
          () => import('@/pages/CRM/OportunidadesKanban'),
          'Carregando Kanban...',
          (node) => <RequirePermission modulo="PAGINA__CRM__PROPOSTAS_COMERCIAIS_KANBAN" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/proposta/:id/preview',
        element: lazyElement(
          () => import('@/pages/CRM/PropostaPreview'),
          'Carregando Proposta...',
          (node) => <RequirePermission modulo="PAGINA__CRM__PROPOSTA_PREVIEW" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/ranking',
        element: lazyElement(
          () => import('@/pages/CRM/Vendedores'),
          'Carregando Ranking...',
          (node) => <RequirePermission modulo="PAGINA__CRM__RANKING" acao="VIEW">{node}</RequirePermission>
        )
      },
      { path: 'crm/oportunidades-kanban', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'crm/oportunidades', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'crm/propostas', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'crm/propostas-comerciais', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'crm/vendedores', element: <Navigate to="/app/crm/ranking" replace /> },
      {
        path: 'crm/clientes',
        element: lazyElement(
          () => import('@/pages/Cadastros/Clientes'),
          'Carregando Clientes...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CLIENTES" acao="VIEW">{node}</RequirePermission>
        )
      },

      { path: 'cadastros/clientes', element: <Navigate to="/app/crm/clientes" replace /> },
      { path: 'cadastros/contatos', element: <Navigate to="/app/crm/clientes" replace /> },
      { path: 'cadastros/fornecedores', element: <Navigate to="/app/crm/clientes" replace /> },
      { path: 'cadastros/transportadora', element: <Navigate to="/app/compras-estoque/transportadora" replace /> },
      { path: 'cadastros/produtos', element: <Navigate to="/app/compras-estoque/consultar-estoque" replace /> },
      { path: 'cadastros/servicos', element: <Navigate to="/app/compras-estoque/servicos" replace /> },

      { path: 'config-gerais/transportadora', element: <Navigate to="/app/compras-estoque/transportadora" replace /> },
      {
        path: 'config-gerais/ibge',
        element: <Navigate to="/app/financeiro/ibge" replace />
      },
      {
        path: 'config-gerais/cnae',
        element: <Navigate to="/app/financeiro/cnae" replace />
      },
      { path: 'financeiro/clientes', element: <Navigate to="/app/crm/clientes" replace /> },
      {
        path: 'financeiro/contas-receber',
        element: lazyElement(
          () => import('@/pages/Financeiro/ContaReceber'),
          'Carregando Contas a Receber...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__CONTAS_RECEBER" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/contas-pagar',
        element: lazyElement(
          () => import('@/pages/Financeiro/ContaPagar'),
          'Carregando Contas a Pagar...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__CONTAS_PAGAR" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/ibge',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Ibge'),
          'Carregando IBGE...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__IBGE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/cnae',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Cnae'),
          'Carregando CNAE...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__CNAE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/formas-pagamento',
        element: lazyElement(
          () => import('@/pages/Financeiro/FormasPagamento'),
          'Carregando Formas de Pagamento...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__FORMAS_PAGAMENTO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/condicoes-pagamento',
        element: lazyElement(
          () => import('@/pages/Financeiro/CondicoesPagamento'),
          'Carregando Condições de Pagamento...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__CONDICOES_PAGAMENTO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/empresas-correspondentes',
        element: lazyElement(
          () => import('@/pages/Financeiro/EmpresasCorrespondentes'),
          'Carregando Empresas Correspondentes...',
          (node) => <RequirePermission modulo="PAGINA__FINANCEIRO__EMPRESAS_CORRESPONDENTES" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'crm/configs/origem-leads',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/OrigemLeads'),
          'Carregando Origem de Leads...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CONFIGS__ORIGEM_LEADS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/motivos',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Motivos'),
          'Carregando Motivos...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CONFIGS__MOTIVOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/verticais',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Verticais'),
          'Carregando Verticais...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CONFIGS__VERTICAIS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/produtos',
        element: <Navigate to="/app/compras-estoque/consultar-estoque" replace />
      },
      {
        path: 'crm/configs/servicos',
        element: <Navigate to="/app/compras-estoque/servicos" replace />
      },
      {
        path: 'crm/configs/etapas',
        element: <Navigate to="/app/crm/configs/fases" replace />
      },
      {
        path: 'crm/configs/fases',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Fases'),
          'Carregando Fases CRM...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CONFIGS__FASES" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/status',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Status'),
          'Carregando Status CRM...',
          (node) => <RequirePermission modulo="PAGINA__CRM__CONFIGS__STATUS" acao="VIEW">{node}</RequirePermission>
        )
      },

      { path: 'comercial/overview', element: <Navigate to="/app/dashboard/comercial" replace /> },
      { path: 'comercial/vendedores', element: <Navigate to="/app/crm/ranking" replace /> },
      { path: 'comercial/oportunidades', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'comercial/propostas-comerciais', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },

      { path: 'comunicacao/chat', element: <Navigate to="/app/comunidade/chat" replace /> },
      { path: 'comunicacao/flowsmart', element: <Navigate to="/app/smartflow/atendimentos" replace /> },

      {
        path: 'comunicacao/ia',
        element: lazyElement(
          () => import('@/pages/Comunicacao/IAFlow'),
          'Carregando IA...',
          (node) => <RequirePermission modulo="PAGINA__COMUNICACAO__IA" acao="VIEW">{node}</RequirePermission>
        )
      },

      { path: 'producao/omie', element: <Navigate to="/app/producao/propostas" replace /> },
      { path: 'producao/servicos-vendas', element: <Navigate to="/app/producao/propostas" replace /> },
      {
        path: 'producao/propostas',
        element: lazyElement(
          () => import('@/pages/CRM/Propostas'),
          'Carregando Propostas...',
          (node) => <RequirePermission modulo="PAGINA__PRODUCAO__PROPOSTAS" acao="VIEW">{node}</RequirePermission>
        )
      },
      { path: 'producao/servicos', element: <Navigate to="/app/producao/ordens-servico" replace /> },
      {
        path: 'producao/ordens-servico',
        element: lazyElement(
          () => import('@/pages/Producao/OrdensServico'),
          'Carregando Ordens de Serviço...',
          (node) => <RequirePermission modulo="PAGINA__PRODUCAO__ORDENS_SERVICO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'producao/equipamentos',
        element: lazyElement(
          () => import('@/pages/Producao/Equipamentos'),
          'Carregando Equipamentos...',
          (node) => <RequirePermission modulo="PAGINA__PRODUCAO__EQUIPAMENTOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'producao/certificado-garantia',
        element: lazyElement(
          () => import('@/pages/Producao/CertificadoGarantia'),
          'Carregando Certificado garantia...',
          (node) => <RequirePermission modulo="PAGINA__PRODUCAO__CERTIFICADO_GARANTIA" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'frota/veiculos',
        element: lazyElement(
          () => import('@/pages/Frota/Veiculos.tsx'),
          'Carregando Veículos...',
          (node) => <RequirePermission modulo="PAGINA__FROTA__VEICULOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'frota/diario-de-bordo',
        element: lazyElement(
          () => import('@/pages/Frota/DiarioBordo.tsx'),
          'Carregando Diário de Bordo...',
          (node) => <RequirePermission modulo="PAGINA__FROTA__DIARIO_BORDO" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'smartflow/atendimentos',
        element: lazyElement(
          () => import('@/pages/Comunicacao/FlowSmart'),
          'Carregando Atendimentos...',
          (node) => <RequirePermission modulo="PAGINA__SMARTFLOW__ATENDIMENTOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'smartflow/kanban-fluxos',
        element: lazyElement(
          () => import('@/pages/SmartFlow/KanbanFluxos'),
          'Carregando Kanban de Fluxos...',
          (node) => <RequirePermission modulo="PAGINA__SMARTFLOW__KANBAN_FLUXOS" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'compras-estoque',
        element: <Navigate to="/app/compras-estoque/consultar-estoque" replace />
      },
      {
        path: 'compras-estoque/compras',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/ComprasKanban'),
          'Carregando Compras...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__COMPRAS" acao="VIEW">{node}</RequirePermission>
        )
      },
      { path: 'compras-estoque/estoque', element: <Navigate to="/app/compras-estoque/consultar-estoque" replace /> },
      {
        path: 'compras-estoque/consultar-estoque',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/ConsultarEstoque'),
          'Carregando Estoque...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__CONSULTAR_ESTOQUE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'compras-estoque/movimentacao',
        element: <Navigate to="/app/compras-estoque/consultar-estoque" replace />
      },
      {
        path: 'compras-estoque/locais-estoque',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/LocaisEstoque'),
          'Carregando Locais do Estoque...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__LOCAIS_ESTOQUE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'compras-estoque/transportadora',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Transportadora'),
          'Carregando Transportadora...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__TRANSPORTADORA" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'compras-estoque/servicos',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/Servicos'),
          'Carregando Serviços...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__SERVICOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'compras-estoque/ncm',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/CadastroNcm'),
          'Carregando Cadastro NCM...',
          (node) => <RequirePermission modulo="PAGINA__COMPRAS_E_ESTOQUE__NCM" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'configuracoes/usuarios',
        element: lazyElement(
          () => import('@/pages/Configuracoes/UsuariosPage'),
          'Carregando Usuários...',
          (node) => <RequirePermission modulo="PAGINA__CONFIGURACOES__USUARIOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'configuracoes/perfil',
        element: lazyElement(() => import('@/pages/Configuracoes/Perfil'), 'Carregando Perfil...')
      },
      {
        path: 'configuracoes/permissoes',
        element: lazyElement(
          () => import('@/pages/Configuracoes/PermissoesPage'),
          'Carregando Gestão de Acessos...',
          (node) => <RequirePermission modulo="PAGINA__CONFIGURACOES__PERMISSOES" acao="VIEW">{node}</RequirePermission>
        )
      },
      { path: 'perfil', element: <Navigate to="/app/configuracoes/perfil" replace /> },

      {
        path: 'administrativo/colaboradores',
        element: lazyElement(
          () => import('@/pages/Documentacao/Colaboradores'),
          'Carregando Colaboradores...',
          (node) => <RequirePermission modulo="PAGINA__ADMINISTRATIVO__COLABORADORES" acao="VIEW" fallbackTo="/app/dashboard/comercial">{node}</RequirePermission>
        )
      },

      { path: 'documentacao/funcionarios', element: <Navigate to="/app/administrativo/colaboradores" replace /> },
      { path: 'documentacao/colaboradores', element: <Navigate to="/app/administrativo/colaboradores" replace /> },
      {
        path: 'documentacao/empresa',
        element: lazyElement(
          () => import('@/pages/Documentacao/Empresa'),
          'Carregando Empresa...',
          (node) => <RequirePermission modulo="PAGINA__DOCUMENTACAO__EMPRESA" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'infra/supabase',
        element: lazyElement(
          () => import('@/pages/Infra/SupabaseHealth'),
          'Carregando Monitoramento...',
          (node) => <RequirePermission modulo="PAGINA__INFRA__SUPABASE" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'universidade/catalogos',
        element: lazyElement(
          () => import('@/pages/Universidade/Catalogos.tsx'),
          'Carregando Catálogos...',
          (node) => <RequirePermission modulo="PAGINA__UNIVERSIDADE__CATALOGOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/manuais',
        element: lazyElement(
          () => import('@/pages/Universidade/Manuais.tsx'),
          'Carregando Manuais...',
          (node) => <RequirePermission modulo="PAGINA__UNIVERSIDADE__MANUAIS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/treinamentos',
        element: lazyElement(
          () => import('@/pages/Universidade/Treinamentos.tsx'),
          'Carregando Treinamentos...',
          (node) => <RequirePermission modulo="PAGINA__UNIVERSIDADE__TREINAMENTOS" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/instrucoes-de-trabalho',
        element: lazyElement(
          () => import('@/pages/Universidade/InstrucoesTrabalho.tsx'),
          'Carregando Instruções de Trabalho...',
          (node) => <RequirePermission modulo="PAGINA__UNIVERSIDADE__INSTRUCOES_TRABALHO" acao="VIEW">{node}</RequirePermission>
        ),
      },
      { path: 'universidade/it-servicos', element: <Navigate to="/app/universidade/instrucoes-de-trabalho" replace /> },
      { path: 'universidade/video-aulas', element: <Navigate to="/app/universidade/treinamentos" replace /> },
    ]
  },

  { path: '*', element: <Navigate to="/login" replace /> }
])

export default router
