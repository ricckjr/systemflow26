import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useAuth } from '../../contexts/AuthContext'
import { Profile, ProfilePermissao } from '../../../types'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, permissions, loading, error } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="loader"></div>
      </div>
    )
  }
  
  if (!session) {
     return <Navigate to="/login" replace state={{ message: 'Sessão expirada. Faça login novamente.' }} />
  }

  // Force profile creation if missing
  const isProfilePage = location.pathname === '/app/configuracoes/perfil'
  if (!profile && !isProfilePage) {
    return <Navigate to="/app/configuracoes/perfil" replace state={{ message: 'Complete seu perfil para continuar.' }} />
  }

  return (
    <Layout profile={profile} perms={permissions as ProfilePermissao[]} errorMessage={error?.message}>
      {children || <Outlet />}
    </Layout>
  )
}
