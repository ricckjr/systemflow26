import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading, authReady, profileReady, error, refreshProfile } = useAuth()
  const location = useLocation()

  if (!authReady || loading || !profileReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-navy-950">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!profile && error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-navy-950 px-6 text-center">
        <h1 className="text-xl font-semibold text-white mb-2">Falha ao carregar permissões</h1>
        <p className="text-sm text-gray-300 mb-6">{error.message}</p>
        <button
          onClick={() => void refreshProfile()}
          className="px-5 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  // Verifica estritamente se é admin
  if (!profile || profile.cargo !== 'ADMIN') {
    // Redireciona para uma rota segura padrão se não tiver permissão
    return <Navigate to="/app/comunidade" replace state={{ message: 'Acesso negado. Área restrita a administradores.' }} />
  }

  return <>{children}</>
}
