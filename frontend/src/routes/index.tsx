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

// Lazy Modules
const InstaFlow = lazy(() => import('@/pages/Comunidade/InstaFlow'))
const TaskFlow = lazy(() => import('@/pages/Comunidade/TaskFlow'))
const VisaoGeral = lazy(() => import('@/pages/Comercial/VisaoGeral'))
const Vendedores = lazy(() => import('@/pages/Comercial/Vendedores'))
const Oportunidades = lazy(() => import('@/pages/Comercial/Oportunidades'))
const ChatInterno = lazy(() => import('@/pages/Comunicacao/ChatInterno'))
const FlowSmart = lazy(() => import('@/pages/Comunicacao/FlowSmart'))
const IAFlow = lazy(() => import('@/pages/Comunicacao/IAFlow'))
const Usuarios = lazy(() => import('@/pages/Configuracoes/Usuarios'))
const Permissoes = lazy(() => import('@/pages/Configuracoes/Permissoes'))
const Perfil = lazy(() => import('@/pages/Configuracoes/Perfil'))
const ServicosVendas = lazy(() => import('@/pages/Producao/OmieKanban'))
const Servicos = lazy(() => import('@/pages/Producao/Servicos'))
const Equipamentos = lazy(() => import('@/pages/Producao/Equipamentos'))

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

      { path: 'comunidade', element: lazyPage(<InstaFlow />, 'Carregando InstaFlow...') },
      { path: 'comunidade/taskflow', element: lazyPage(<TaskFlow />, 'Carregando TaskFlow...') },

      { path: 'comercial/overview', element: lazyPage(<VisaoGeral />, 'Carregando Visão Comercial...') },
      { path: 'comercial/vendedores', element: lazyPage(<Vendedores />, 'Carregando Vendedores...') },
      { path: 'comercial/oportunidades', element: lazyPage(<Oportunidades />, 'Carregando Oportunidades...') },

      { path: 'comunicacao/chat', element: lazyPage(<ChatInterno />, 'Carregando Chat...') },
      { path: 'comunicacao/flowsmart', element: lazyPage(<FlowSmart />, 'Carregando FlowSmart...') },
      { path: 'comunicacao/ia', element: lazyPage(<IAFlow />, 'Carregando IA...') },

      { path: 'producao/omie', element: <Navigate to="/app/producao/servicos-vendas" replace /> },
      { path: 'producao/servicos-vendas', element: lazyPage(<ServicosVendas />, 'Carregando Serviços/Vendas...') },
      { path: 'producao/servicos', element: lazyPage(<Servicos />, 'Carregando Serviços...') },
      { path: 'producao/equipamentos', element: lazyPage(<Equipamentos />, 'Carregando Equipamentos...') },

      { path: 'configuracoes/usuarios', element: lazyPage(<RequireAdmin><Usuarios /></RequireAdmin>, 'Carregando Usuários...') },
      { path: 'configuracoes/perfil', element: lazyPage(<Perfil />, 'Carregando Perfil...') },
      { path: 'configuracoes/permissoes', element: lazyPage(<RequireAdmin><Permissoes /></RequireAdmin>, 'Carregando Permissões...') },
    ]
  },

  { path: '*', element: <Navigate to="/login" replace /> }
])

export default router
