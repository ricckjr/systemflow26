import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const { session, loadingSession } = useAuth()

  useEffect(() => {
    // Aguarda AuthContext resolver a sessão
    if (loadingSession) return

    if (session) {
      navigate('/app', { replace: true })
    } else {
      navigate('/login?error=auth_failed', { replace: true })
    }
  }, [session, loadingSession, navigate])

  return (
    <div className="min-h-screen bg-[#081522] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto" />
        <p className="text-white text-sm">Autenticando...</p>
      </div>
    </div>
  )
}

export default AuthCallback
