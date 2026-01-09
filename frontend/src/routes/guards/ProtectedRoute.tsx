import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Profile, ProfilePermissao } from '@/types'

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
  // Adicionado check !error para evitar redirect em caso de falha de conexão/timeout
  if (!profile && !loading && !error) {
     if (!isProfilePage) {
         return <Navigate to="/app/configuracoes/perfil" replace state={{ message: 'Complete seu perfil para continuar.' }} />
     }
  }

  if (profile && !profile.ativo) {
     return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-navy-950 text-white">
            <h1 className="text-2xl font-bold mb-4">Acesso Bloqueado</h1>
            <p className="text-gray-300 mb-6">Seu usuário foi desativado. Entre em contato com o administrador.</p>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
            >
              Voltar ao Login
            </button>
        </div>
    )
  }

  return (
    <Layout profile={profile} perms={permissions as ProfilePermissao[]} errorMessage={error?.message}>
      {children || <Outlet />}
    </Layout>
  )
}
