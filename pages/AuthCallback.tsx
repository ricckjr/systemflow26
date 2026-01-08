import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../src/contexts/AuthContext'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const { session } = useAuth()

  useEffect(() => {
    // Processar callback de OAuth ou Magic Link
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession()
      if (error) {
        console.error('Erro no callback de auth:', error)
        navigate('/login?error=callback_failed')
      } else {
        navigate('/app')
      }
    }

    if (session) {
      navigate('/app')
    } else {
      handleCallback()
    }
  }, [navigate, session])

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
