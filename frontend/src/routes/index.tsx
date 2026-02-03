import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './guards/ProtectedRoute'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthCallback from '@/pages/AuthCallback'
import RequireAdmin from './guards/RequireAdmin'
import RequirePermission from './guards/RequirePermission'

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

  // =========================
  // APP (Protected)
  // =========================
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard/comercial" replace /> },

      { path: 'comunidade', element: lazyElement(() => import('@/pages/Comunidade/InstaFlow'), 'Carregando InstaFlow...') },
      { path: 'comunidade/taskflow', element: lazyElement(() => import('@/pages/Comunidade/TaskFlow'), 'Carregando TaskFlow...') },
      { path: 'comunidade/chat', element: lazyElement(() => import('@/pages/Comunicacao/ChatInterno'), 'Carregando Chat...') },
      { path: 'comunidade/calendario', element: lazyElement(() => import('@/pages/Comunidade/Calendario'), 'Carregando Calendário...') },

      {
        path: 'dashboard/comercial',
        element: lazyElement(
          () => import('@/pages/dashboard/VisaoGeral'),
          'Carregando Comercial...',
          (node) => <RequirePermission modulo="DASHBOARD" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'crm/propostas-comerciais-kanban',
        element: lazyElement(
          () => import('@/pages/CRM/OportunidadesKanban'),
          'Carregando Kanban...',
          (node) => <RequirePermission modulo="CRM" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/ranking',
        element: lazyElement(
          () => import('@/pages/CRM/Vendedores'),
          'Carregando Ranking...',
          (node) => <RequirePermission modulo="CRM" acao="VIEW">{node}</RequirePermission>
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
          (node) => <RequirePermission modulo="CRM" acao="VIEW">{node}</RequirePermission>
        )
      },

      { path: 'cadastros/clientes', element: <Navigate to="/app/crm/clientes" replace /> },
      { path: 'cadastros/contatos', element: <Navigate to="/app/crm/clientes" replace /> },
      { path: 'cadastros/fornecedores', element: <Navigate to="/app/crm/clientes" replace /> },

      {
        path: 'config-gerais/transportadora',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Transportadora'),
          'Carregando Transportadora...',
          (node) => <RequirePermission modulo="CONFIGURACOES" acao="VIEW">{node}</RequirePermission>
        )
      },
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
          (node) => <RequirePermission modulo="FINANCEIRO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/contas-pagar',
        element: lazyElement(
          () => import('@/pages/Financeiro/ContaPagar'),
          'Carregando Contas a Pagar...',
          (node) => <RequirePermission modulo="FINANCEIRO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/ibge',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Ibge'),
          'Carregando IBGE...',
          (node) => <RequirePermission modulo="FINANCEIRO" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'financeiro/cnae',
        element: lazyElement(
          () => import('@/pages/ConfigGerais/Cnae'),
          'Carregando CNAE...',
          (node) => <RequirePermission modulo="FINANCEIRO" acao="CONTROL">{node}</RequirePermission>
        )
      },

      {
        path: 'crm/configs/origem-leads',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/OrigemLeads'),
          'Carregando Origem de Leads...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/motivos',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Motivos'),
          'Carregando Motivos...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/verticais',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Verticais'),
          'Carregando Verticais...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/produtos',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Produtos'),
          'Carregando Produtos...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/servicos',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Servicos'),
          'Carregando Serviços...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
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
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },
      {
        path: 'crm/configs/status',
        element: lazyElement(
          () => import('@/pages/CRM/Configs/Status'),
          'Carregando Status CRM...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },

      { path: 'comercial/overview', element: <Navigate to="/app/dashboard/comercial" replace /> },
      { path: 'comercial/vendedores', element: <Navigate to="/app/crm/ranking" replace /> },
      { path: 'comercial/oportunidades', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },
      { path: 'comercial/propostas-comerciais', element: <Navigate to="/app/crm/propostas-comerciais-kanban" replace /> },

      { path: 'comunicacao/chat', element: <Navigate to="/app/comunidade/chat" replace /> },
      { path: 'comunicacao/flowsmart', element: <Navigate to="/app/smartflow/atendimentos" replace /> },
      { path: 'comunicacao/ia', element: lazyElement(() => import('@/pages/Comunicacao/IAFlow'), 'Carregando IA...') },

      { path: 'producao/omie', element: <Navigate to="/app/producao/propostas" replace /> },
      { path: 'producao/servicos-vendas', element: <Navigate to="/app/producao/propostas" replace /> },
      {
        path: 'producao/propostas',
        element: lazyElement(
          () => import('@/pages/CRM/Propostas'),
          'Carregando Propostas...',
          (node) => <RequirePermission modulo="PRODUCAO" acao="VIEW">{node}</RequirePermission>
        )
      },
      { path: 'producao/servicos', element: <Navigate to="/app/producao/ordens-servico" replace /> },
      {
        path: 'producao/ordens-servico',
        element: lazyElement(
          () => import('@/pages/Producao/OrdensServico'),
          'Carregando Ordens de Serviço...',
          (node) => <RequirePermission modulo="PRODUCAO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'producao/equipamentos',
        element: lazyElement(
          () => import('@/pages/Producao/Equipamentos'),
          'Carregando Equipamentos...',
          (node) => <RequirePermission modulo="PRODUCAO" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'producao/certificado-garantia',
        element: lazyElement(
          () => import('@/pages/Producao/CertificadoGarantia'),
          'Carregando Certificado garantia...',
          (node) => <RequirePermission modulo="PRODUCAO" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'frota/veiculos',
        element: lazyElement(
          () => import('@/pages/Frota/Veiculos.tsx'),
          'Carregando Veículos...',
          (node) => <RequirePermission modulo="FROTA" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'frota/diario-de-bordo',
        element: lazyElement(
          () => import('@/pages/Frota/DiarioBordo.tsx'),
          'Carregando Diário de Bordo...',
          (node) => <RequirePermission modulo="FROTA" acao="VIEW">{node}</RequirePermission>
        )
      },

      {
        path: 'smartflow/atendimentos',
        element: lazyElement(
          () => import('@/pages/Comunicacao/FlowSmart'),
          'Carregando Atendimentos...',
          (node) => <RequirePermission modulo="SMARTFLOW" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'smartflow/kanban-fluxos',
        element: lazyElement(
          () => import('@/pages/SmartFlow/KanbanFluxos'),
          'Carregando Kanban de Fluxos...',
          (node) => <RequirePermission modulo="SMARTFLOW" acao="VIEW">{node}</RequirePermission>
        )
      },

      { path: 'compras-estoque', element: lazyElement(() => import('@/pages/ComprasEstoque/VisaoGeral'), 'Carregando Compras e Estoque...') },
      { path: 'compras-estoque/compras', element: lazyElement(() => import('@/pages/ComprasEstoque/ComprasKanban'), 'Carregando Compras...') },
      {
        path: 'compras-estoque/ncm',
        element: lazyElement(
          () => import('@/pages/ComprasEstoque/CadastroNcm'),
          'Carregando Cadastro NCM...',
          (node) => <RequirePermission modulo="CRM" acao="CONTROL">{node}</RequirePermission>
        )
      },

      {
        path: 'configuracoes/usuarios',
        element: lazyElement(
          () => import('@/pages/Configuracoes/UsuariosPage'),
          'Carregando Usuários...',
          (node) => <RequirePermission modulo="CONFIGURACOES" acao="CONTROL">{node}</RequirePermission>
        )
      },
      { path: 'configuracoes/perfil', element: lazyElement(() => import('@/pages/Configuracoes/Perfil'), 'Carregando Perfil...') },
      {
        path: 'configuracoes/permissoes',
        element: lazyElement(
          () => import('@/pages/Configuracoes/PermissoesPage'),
          'Carregando Permissões...',
          (node) => <RequirePermission modulo="CONFIGURACOES" acao="CONTROL">{node}</RequirePermission>
        )
      },

      { path: 'infra/supabase', element: lazyElement(() => import('@/pages/Infra/SupabaseHealth'), 'Carregando Monitoramento...') },

      {
        path: 'universidade/catalogos',
        element: lazyElement(
          () => import('@/pages/Universidade/Catalogos.tsx'),
          'Carregando Catálogos...',
          (node) => <RequirePermission modulo="UNIVERSIDADE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/manuais',
        element: lazyElement(
          () => import('@/pages/Universidade/Manuais.tsx'),
          'Carregando Manuais...',
          (node) => <RequirePermission modulo="UNIVERSIDADE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/treinamentos',
        element: lazyElement(
          () => import('@/pages/Universidade/Treinamentos.tsx'),
          'Carregando Treinamentos...',
          (node) => <RequirePermission modulo="UNIVERSIDADE" acao="VIEW">{node}</RequirePermission>
        )
      },
      {
        path: 'universidade/instrucoes-de-trabalho',
        element: lazyElement(
          () => import('@/pages/Universidade/InstrucoesTrabalho.tsx'),
          'Carregando Instruções de Trabalho...',
          (node) => <RequirePermission modulo="UNIVERSIDADE" acao="VIEW">{node}</RequirePermission>
        ),
      },
      { path: 'universidade/it-servicos', element: <Navigate to="/app/universidade/instrucoes-de-trabalho" replace /> },
      { path: 'universidade/video-aulas', element: <Navigate to="/app/universidade/treinamentos" replace /> },
    ]
  },

  { path: '*', element: <Navigate to="/login" replace /> }
])

export default router
