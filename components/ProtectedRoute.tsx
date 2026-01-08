import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Layout from './Layout'
import { useAuth } from '../context/AuthContext'
import { Profile, ProfilePermissao } from '../types'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, permissions, loading, error, refreshProfile, signOut } = useAuth()

  // Remove a tela de bloqueio "Validando sua sessão segura..."
  // Se estiver carregando e ainda não tivermos sessão (inicialização), aguardamos silenciosamente.
  if (loading && !session) {
    return null
  }
  
  if (!session) {
     return <Navigate to="/login" replace state={{ message: 'Sessão expirada. Faça login novamente.' }} />
  }

  // Se houver erro CRÍTICO (401), o AuthContext já teria feito logout.
  // Se houver erro de rede (offline), o AuthContext manteve a sessão e gerou fallback.
  // Portanto, aqui NÃO bloqueamos mais a renderização baseado em 'error' ou 'profile'.
  // O Layout vai lidar com profile=null (skeleton) ou profile=fallback.

  return (
    <Layout profile={profile} perms={permissions as ProfilePermissao[]}>
      {children || <Outlet />}
    </Layout>
  )
}
