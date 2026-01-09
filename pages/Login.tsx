import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../src/contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { logInfo, logError } from '../utils/logger'
import capaLogin from '../src/assets/capalogin.png'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navMessage = (location.state as any)?.message as string | undefined

  useEffect(() => {
    if (!loading && session) {
      navigate('/app', { replace: true })
    }
  }, [loading, session, navigate])

  // Show loader while checking auth state to prevent flash of content/image aborts
  if (loading || session) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#38BDF8]" size={48} />
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    try {
      logInfo('auth', 'login attempt', { email })
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      logInfo('auth', 'login success', { email })
      // A navegação será tratada pelo useEffect quando loading for false e session existir
    } catch (err: any) {
      logError('auth', 'login failed', err)
      setError(err.message || 'Falha ao autenticar')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#0B0F14] text-white">

      {/* ================= ESQUERDA ================= */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden">
        <img
          src={capaLogin}
          alt="SystemFlow"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14]/95 via-[#0B0F14]/75 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end p-16 max-w-xl">
          <h1 className="text-5xl font-extrabold tracking-tight">
            SystemFlow
          </h1>
          <p className="mt-4 text-base text-white/80 leading-relaxed">
            Sua gestão mais inteligente.
            <br />
            Automação, controle e performance industrial em um único sistema.
          </p>
        </div>
      </div>

      {/* ================= DIREITA ================= */}
      <div className="lg:col-span-5 flex items-center justify-center px-6 sm:px-10">
        <div className="w-full max-w-md">

          <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-10 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">

            {/* Logo */}
            <div className="flex justify-center mb-10">
              <img
                src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
                alt="ApliFlow"
                className="h-12"
              />
            </div>

            {navMessage && (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                {navMessage}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">

              {/* EMAIL */}
              <div>
                <label className="block text-xs font-semibold tracking-widest text-white/60 mb-2">
                  E-MAIL
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-black"
                    size={16}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="
                      w-full h-12 pl-11 pr-4
                      rounded-xl
                      bg-[#EEF4FF]
                      border border-transparent
                      text-[#0B0F14]
                      placeholder:text-gray-500
                      focus:outline-none
                      focus:border-[#38BDF8]
                      focus:ring-2 focus:ring-[#38BDF8]/30
                      transition
                    "
                    placeholder="usuario@empresa.com"
                  />
                </div>
              </div>

              {/* SENHA */}
              <div>
                <label className="block text-xs font-semibold tracking-widest text-white/60 mb-2">
                  SENHA
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-black"
                    size={16}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="
                      w-full h-12 pl-11 pr-12
                      rounded-xl
                      bg-[#EEF4FF]
                      border border-transparent
                      text-[#0B0F14]
                      placeholder:text-gray-500
                      focus:outline-none
                      focus:border-[#38BDF8]
                      focus:ring-2 focus:ring-[#38BDF8]/30
                      transition
                    "
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* BOTÃO */}
              <button
                type="submit"
                disabled={submitting}
                className="
                  w-full h-12
                  rounded-xl
                  bg-[#38BDF8]
                  hover:bg-[#0EA5E9]
                  text-[#0B0F14]
                  font-bold
                  tracking-wide
                  transition
                  shadow-[0_12px_30px_rgba(56,189,248,0.35)]
                  hover:-translate-y-[1px]
                  disabled:opacity-60
                  flex items-center justify-center
                "
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  'ENTRAR'
                )}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
