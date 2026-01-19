import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import { ProfilePermissao } from '@/types'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const {
    session,
    profile,
    permissions,
    authReady,
    profileReady,
  } = useAuth()

  const location = useLocation()

  /**
   * 1️⃣ Ainda inicializando auth ou profile
   * (reload, F5, troca de aba)
   */
  if (!authReady || (session && !profileReady)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="loader" />
      </div>
    )
  }

  /**
   * 2️⃣ Sem sessão (auth já checado)
   */
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ message: 'Sessão expirada. Faça login novamente.' }}
      />
    )
  }

  /**
   * 3️⃣ Perfil inexistente → forçar completar cadastro
   * (somente depois do profileReady)
   */
  const isProfilePage = location.pathname === '/app/configuracoes/perfil'

  if (profileReady && !profile && !isProfilePage) {
    return (
      <Navigate
        to="/app/configuracoes/perfil"
        replace
        state={{ message: 'Complete seu perfil para continuar.' }}
      />
    )
  }

  /**
   * 4️⃣ Usuário desativado
   */
  if (profile?.ativo === false) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-navy-950 text-white">
        <h1 className="text-2xl font-bold mb-4">Acesso Bloqueado</h1>
        <p className="text-gray-300 mb-6">
          Seu usuário foi desativado. Entre em contato com o administrador.
        </p>
        <button
          onClick={() => (window.location.href = '/login')}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium"
        >
          Voltar ao Login
        </button>
      </div>
    )
  }

  /**
   * 5️⃣ Tudo OK → renderiza layout
   */
  return (
    <Layout
      profile={profile}
      perms={permissions as ProfilePermissao[]}
    >
      {children || <Outlet />}
    </Layout>
  )
}
