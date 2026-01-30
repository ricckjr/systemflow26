import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, authReady, profileReady, permissions, can } = useAuth()
  const location = useLocation()

  if ((!authReady || !profileReady) && !profile) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-navy-950">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!permissions) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-navy-950">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!profile || (!can('CONFIGURACOES', 'CONTROL') && profile.cargo !== 'ADMIN')) {
    // Redireciona para uma rota segura padrão se não tiver permissão
    return <Navigate to="/app/comunidade" replace state={{ message: 'Acesso negado. Área restrita a administradores.' }} />
  }

  return <>{children}</>
}
