import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0b1e2d]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/app/comunidade" replace state={{ message: 'Acesso restrito a administradores', from: location.pathname }} />
  }

  return <>{children}</>
}
