import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { Profile, ProfilePermissao } from '@/types'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, permissions, loading, error, authReady, profileReady, refreshProfile, signOut } = useAuth()
  const location = useLocation()

  if (!authReady || loading || (session && !profileReady)) {
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
  if (!profile && !loading && !error && profileReady) {
     if (!isProfilePage) {
         return <Navigate to="/app/configuracoes/perfil" replace state={{ message: 'Complete seu perfil para continuar.' }} />
     }
  }

  if (!profile && error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-main)] px-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Falha ao carregar seu perfil</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{error.message}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => void refreshProfile()}
            className="px-5 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => void signOut()}
            className="px-5 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Sair
          </button>
        </div>
      </div>
    )
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
