import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Validar se o usuário chegou aqui via link de reset (tem hash com access_token)
  // O Supabase Auth automaticamente trata o hash #access_token=...&type=recovery
  // e estabelece a sessão antes de renderizar o componente se usarmos onAuthStateChange ou getSession.
  // Mas vamos garantir que há uma sessão ativa de recuperação.

  useEffect(() => {
    // Checar se hash contém type=recovery ou error
    const hash = location.hash
    if (hash && hash.includes('error_description')) {
      setError('Link de recuperação inválido ou expirado.')
    }
  }, [location])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setSuccess(true)
      // Opcional: Deslogar de outros dispositivos ou limpar sessão
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#081522] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
            <Lock size={32} className="text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nova Senha</h1>
          <p className="text-industrial-text-secondary mt-2 text-sm">
            Crie uma nova senha segura para sua conta.
          </p>
        </div>

        {/* Card */}
        <div className="bg-industrial-surface border border-industrial-border rounded-2xl shadow-2xl p-6 sm:p-8">
          
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-white font-bold text-lg">Senha Alterada!</h3>
              <p className="text-industrial-text-secondary text-sm">
                Sua senha foi atualizada com sucesso. Você já pode acessar o sistema com a nova credencial.
              </p>
              <Link to="/login" className="w-full mt-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2">
                Ir para Login
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-industrial-text-secondary uppercase ml-1">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-white placeholder:text-industrial-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all pr-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-industrial-text-secondary hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-industrial-text-secondary uppercase ml-1">Confirmar Senha</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-white placeholder:text-industrial-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="Repita a nova senha"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Definir Nova Senha'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
