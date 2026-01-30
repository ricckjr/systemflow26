import React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function RequirePermission({
  children,
  modulo,
  acao,
  fallbackTo = '/app/comunidade'
}: {
  children: React.ReactNode
  modulo: string
  acao: string
  fallbackTo?: string
}) {
  const { profile, authReady, profileReady, permissions, can } = useAuth()

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

  if (!can(modulo, acao)) {
    return <Navigate to={fallbackTo} replace state={{ message: 'Acesso negado.' }} />
  }

  return <>{children}</>
}

