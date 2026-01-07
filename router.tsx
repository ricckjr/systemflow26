import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import AuthCallback from './pages/AuthCallback'
import { Profile, ProfilePermissao } from './types'
import RequireAdmin from './components/RequireAdmin'

// Auth Pages
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Lazy Modules
const InstaFlow = lazy(() => import('./pages/Comunidade/InstaFlow'))
const TaskFlow = lazy(() => import('./pages/Comunidade/TaskFlow'))
const VisaoGeral = lazy(() => import('./pages/Comercial/VisaoGeral'))
const Vendedores = lazy(() => import('./pages/Comercial/Vendedores'))
const Oportunidades = lazy(() => import('./pages/Comercial/Oportunidades'))
const ChatInterno = lazy(() => import('./pages/Comunicacao/ChatInterno'))
const FlowSmart = lazy(() => import('./pages/Comunicacao/FlowSmart'))
const IAFlow = lazy(() => import('./pages/Comunicacao/IAFlow'))
const Usuarios = lazy(() => import('./pages/Configuracoes/Usuarios'))
const Permissoes = lazy(() => import('./pages/Configuracoes/Permissoes'))
const Perfil = lazy(() => import('./pages/Configuracoes/Perfil'))
const Tests = lazy(() => import('./pages/Debug/Tests'))

// ==============================
// Loader
// ==============================
const Loader = ({ text = 'Carregando...' }: { text?: string }) => (
  <div className="p-6 text-center text-sm text-blue-400">{text}</div>
)

// ==============================
// HOC: WithAuth
// ==============================

interface InjectedProps {
  profile: Profile;
  perms: ProfilePermissao[];
}

function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  // Returns a component that requires original props MINUS the injected ones
  return function Wrapped(props: Omit<P, keyof InjectedProps>) {
    const { profile, perms } = useAuth()

    if (!profile) return <Loader text="Carregando usuário..." />

    // Create full props object
    const componentProps = {
      ...props,
      profile,
      perms: perms
    } as unknown as P;

    return <Component {...componentProps} />
  }
}

// Pages with injected auth
const InstaFlowPage = withAuth(InstaFlow)
const TaskFlowPage = withAuth(TaskFlow)
const ChatPage = withAuth(ChatInterno)
const IAPage = withAuth(IAFlow)
const UsuariosPage = withAuth(Usuarios)
const PermissoesPage = withAuth(Permissoes)
const PerfilPage = withAuth(Perfil)

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

      { path: 'comunidade', element: lazyPage(<InstaFlowPage />, 'Carregando InstaFlow...') },
      { path: 'comunidade/taskflow', element: lazyPage(<TaskFlowPage />, 'Carregando TaskFlow...') },

      { path: 'comercial/overview', element: lazyPage(<VisaoGeral />, 'Carregando Visão Comercial...') },
      { path: 'comercial/vendedores', element: lazyPage(<Vendedores />, 'Carregando Vendedores...') },
      { path: 'comercial/oportunidades', element: lazyPage(<Oportunidades />, 'Carregando Oportunidades...') },

      { path: 'comunicacao/chat', element: lazyPage(<ChatPage />, 'Carregando Chat...') },
      { path: 'comunicacao/flowsmart', element: lazyPage(<FlowSmart />, 'Carregando FlowSmart...') },
      { path: 'comunicacao/ia', element: lazyPage(<IAPage />, 'Carregando IA...') },

      { path: 'configuracoes/usuarios', element: lazyPage(<RequireAdmin><UsuariosPage /></RequireAdmin>, 'Carregando Usuários...') },
      { path: 'configuracoes/perfil', element: lazyPage(<PerfilPage />, 'Carregando Perfil...') },
      { path: 'configuracoes/permissoes', element: lazyPage(<RequireAdmin><PermissoesPage /></RequireAdmin>, 'Carregando Permissões...') },

      { path: 'debug/tests', element: lazyPage(<Tests />, 'Executando testes...') },
    ]
  },

  { path: '*', element: <Navigate to="/login" replace /> }
])
