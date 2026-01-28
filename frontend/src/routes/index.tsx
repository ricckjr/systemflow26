import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './guards/ProtectedRoute'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthCallback from '@/pages/AuthCallback'
import RequireAdmin from './guards/RequireAdmin'

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
      { index: true, element: <Navigate to="/app/comunidade" replace /> },

      { path: 'comunidade', element: lazyElement(() => import('@/pages/Comunidade/InstaFlow'), 'Carregando InstaFlow...') },
      { path: 'comunidade/taskflow', element: lazyElement(() => import('@/pages/Comunidade/TaskFlow'), 'Carregando TaskFlow...') },

      { path: 'comercial/overview', element: lazyElement(() => import('@/pages/Comercial/VisaoGeral'), 'Carregando Visão Comercial...') },
      { path: 'comercial/vendedores', element: lazyElement(() => import('@/pages/Comercial/Vendedores'), 'Carregando Vendedores...') },
      { path: 'comercial/oportunidades', element: lazyElement(() => import('@/pages/Comercial/Oportunidades'), 'Carregando Oportunidades...') },

      { path: 'comunicacao/chat', element: lazyElement(() => import('@/pages/Comunicacao/ChatInterno'), 'Carregando Chat...') },
      { path: 'comunicacao/flowsmart', element: lazyElement(() => import('@/pages/Comunicacao/FlowSmart'), 'Carregando FlowSmart...') },
      { path: 'comunicacao/ia', element: lazyElement(() => import('@/pages/Comunicacao/IAFlow'), 'Carregando IA...') },

      { path: 'producao/omie', element: <Navigate to="/app/producao/propostas" replace /> },
      { path: 'producao/servicos-vendas', element: <Navigate to="/app/producao/propostas" replace /> },
      { path: 'producao/propostas', element: lazyElement(() => import('@/pages/Producao/Propostas'), 'Carregando Propostas...') },
      { path: 'producao/servicos', element: <Navigate to="/app/producao/ordens-servico" replace /> },
      { path: 'producao/ordens-servico', element: lazyElement(() => import('@/pages/Producao/OrdensServico'), 'Carregando Ordens de Serviço...') },
      { path: 'producao/equipamentos', element: lazyElement(() => import('@/pages/Producao/Equipamentos'), 'Carregando Equipamentos...') },

      { path: 'frota/veiculos', element: lazyElement(() => import('@/pages/Frota/Veiculos.tsx'), 'Carregando Veículos...') },
      { path: 'frota/diario-de-bordo', element: lazyElement(() => import('@/pages/Frota/DiarioBordo.tsx'), 'Carregando Diário de Bordo...') },

      {
        path: 'configuracoes/usuarios',
        element: lazyElement(
          () => import('@/pages/Configuracoes/Usuarios'),
          'Carregando Usuários...',
          (node) => <RequireAdmin>{node}</RequireAdmin>
        )
      },
      { path: 'configuracoes/perfil', element: lazyElement(() => import('@/pages/Configuracoes/Perfil'), 'Carregando Perfil...') },
      {
        path: 'configuracoes/permissoes',
        element: lazyElement(
          () => import('@/pages/Configuracoes/Permissoes'),
          'Carregando Permissões...',
          (node) => <RequireAdmin>{node}</RequireAdmin>
        )
      },

      { path: 'infra/supabase', element: lazyElement(() => import('@/pages/Infra/SupabaseHealth'), 'Carregando Monitoramento...') },

      { path: 'universidade/catalogos', element: lazyElement(() => import('@/pages/Universidade/Catalogos.tsx'), 'Carregando Catálogos...') },
      { path: 'universidade/manuais', element: lazyElement(() => import('@/pages/Universidade/Manuais.tsx'), 'Carregando Manuais...') },
      { path: 'universidade/treinamentos', element: lazyElement(() => import('@/pages/Universidade/Treinamentos.tsx'), 'Carregando Treinamentos...') },
      {
        path: 'universidade/instrucoes-de-trabalho',
        element: lazyElement(
          () => import('@/pages/Universidade/InstrucoesTrabalho.tsx'),
          'Carregando Instruções de Trabalho...'
        ),
      },
      { path: 'universidade/it-servicos', element: <Navigate to="/app/universidade/instrucoes-de-trabalho" replace /> },
      { path: 'universidade/video-aulas', element: <Navigate to="/app/universidade/treinamentos" replace /> },
    ]
  },

  { path: '*', element: <Navigate to="/login" replace /> }
])

export default router
