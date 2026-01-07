import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import capaLogin from './imagem/capalogin.png'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAuth() // Monitora a sessão do contexto
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remember, setRemember] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const navMessage = (location.state as any)?.message as string | undefined

  // Redireciona automaticamente se já estiver logado (e o contexto já tiver atualizado)
  useEffect(() => {
    if (!loading && session) {
      navigate('/app/comunidade', { replace: true })
    }
  }, [session, loading, navigate])

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberEmail') || ''
    const savedRemember = localStorage.getItem('remember') === 'true'
    if (savedEmail) setEmail(savedEmail)
    setRemember(savedRemember)
  }, [])

  const validateEmail = (v: string) => {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    setFieldErrors(p => ({ ...p, email: ok ? undefined : 'E-mail inválido' }))
    return ok
  }

  const validatePassword = (v: string) => {
    const ok = v.trim().length >= 6
    setFieldErrors(p => ({ ...p, password: ok ? undefined : 'Mínimo 6 caracteres' }))
    return ok
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalLoading(true)
    setError(null)

    try {
      if (!validateEmail(email) || !validatePassword(password)) {
        throw new Error('Verifique os campos')
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      if (data.user) {
        remember
          ? localStorage.setItem('rememberEmail', email)
          : localStorage.removeItem('rememberEmail')
        remember
          ? localStorage.setItem('remember', 'true')
          : localStorage.removeItem('remember')

        // Verificação opcional de status do perfil (apenas se a query funcionar)
        try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('ativo, status')
              .eq('id', data.user.id)
              .single()
            
            // Só valida se trouxer dados com sucesso. Se der erro (ex: rede/RLS), deixa passar e o AuthContext resolve.
            if (!profileError && profile) {
                if (profile.ativo === false) throw new Error('Conta desativada. Entre em contato com o suporte.')
                if (profile.status === 'bloqueado') throw new Error('Conta bloqueada por segurança.')
            }
        } catch (err: any) {
            // Se for erro de validação (conta desativada/bloqueada), repassa o erro e desloga
            if (err.message.includes('Conta')) {
                await supabase.auth.signOut()
                throw err
            }
            // Se for erro de rede/query, ignora e deixa o fluxo seguir (resiliência)
            console.warn('Login: Erro não-bloqueante ao verificar perfil:', err)
        }
        
        // Aguarda hidratação da sessão de forma explícita para evitar loop
        const start = Date.now()
        let ok = false
        while (Date.now() - start < 2500) {
          const { data: s } = await supabase.auth.getSession()
          if (s?.session) { ok = true; break }
          await new Promise(r => setTimeout(r, 200))
        }
        if (ok) {
          navigate('/app', { replace: true })
        } else {
          throw new Error('Falha ao estabelecer sessão. Tente novamente.')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação')
      setLocalLoading(false) // Só para loading se der erro. Se sucesso, mantemos loading até o redirect.
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background text-white relative overflow-hidden">

      

      <div className="hidden lg:block w-[55%] relative overflow-hidden">
        <img src={capaLogin} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-background/80" />
      </div>

      

      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-[520px] bg-card border border-line rounded-[24px] p-10">

          <div className="flex justify-center mb-8">
            <img
              src="https://apliflow.com.br/wp-content/uploads/2024/06/af-prata-e-azul-1-1.png"
              alt="ApliFlow"
              className="h-16"
            />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {navMessage && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm">
                {navMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => validateEmail(email)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!fieldErrors.email}
                aria-describedby="email-error"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/7 border border-white/10 text-white outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 hover:bg-white/10"
                placeholder="E-mail"
              />
            </div>
            {fieldErrors.email && (
              <p id="email-error" className="text-xs text-red-400 ml-1 -mt-1">
                {fieldErrors.email}
              </p>
            )}

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => validatePassword(password)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!fieldErrors.password}
                aria-describedby="password-error"
                className="w-full h-12 pl-10 pr-10 rounded-xl bg-white/7 border border-white/10 text-white outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 hover:bg-white/10"
                placeholder="Senha"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="text-xs text-red-400 ml-1 -mt-1">
                {fieldErrors.password}
              </p>
            )}

            <button
              type="submit"
              disabled={localLoading}
              aria-busy={localLoading}
              className="w-full h-12 bg-brand-600 rounded-full font-bold flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-70 disabled:pointer-events-none"
            >
              {localLoading ? <Loader2 className="animate-spin" /> : 'Entrar'}
              {!localLoading && <ArrowRight size={16} />}
            </button>

            <div className="flex items-center justify-between text-xs text-zinc-400 mt-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} />
                Manter conectado
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="hover:text-blue-400 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
