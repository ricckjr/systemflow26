import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Captcha simples (Matemático)
  const [num1] = useState(Math.floor(Math.random() * 10))
  const [num2] = useState(Math.floor(Math.random() * 10))
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validar Captcha
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError('Resposta do captcha incorreta.')
      return
    }

    setLoading(true)

  try {
      // 1. Verificar Rate Limit (via RPC criado na migration)
      const { data: limitData, error: limitError } = await ((supabase as any).rpc('request_password_reset', { p_email: email }))

      if (limitError) throw limitError
      const limitInfo = (limitData || null) as { success: boolean; message?: string } | null
      if (limitInfo && !limitInfo.success) {
        throw new Error(limitInfo.message || 'Muitas tentativas.')
      }

      // 2. Enviar email de reset (usando API nativa do Supabase)
      // O redirectTo deve apontar para a página de ResetPassword
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) throw resetError

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar redefinição.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#081522] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
            <Mail size={32} className="text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Recuperar Senha</h1>
          <p className="text-industrial-text-secondary mt-2 text-sm">
            Informe seu e-mail para receber as instruções de redefinição.
          </p>
        </div>

        {/* Card */}
        <div className="bg-industrial-surface border border-industrial-border rounded-2xl shadow-2xl p-6 sm:p-8">
          
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-white font-bold text-lg">E-mail enviado!</h3>
              <p className="text-industrial-text-secondary text-sm">
                Verifique sua caixa de entrada (e spam) para redefinir sua senha. O link expira em 1 hora.
              </p>
              <Link to="/login" className="inline-block mt-4 text-brand-400 hover:text-brand-300 font-bold text-sm">
                Voltar para Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-5">
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-industrial-text-secondary uppercase ml-1">E-mail Corporativo</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-white placeholder:text-industrial-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="seu.email@empresa.com"
                />
              </div>

              {/* Captcha Simples */}
              <div className="space-y-1.5">
                 <label className="text-xs font-bold text-industrial-text-secondary uppercase ml-1">Verificação de Segurança</label>
                 <div className="flex gap-3">
                   <div className="px-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-white font-mono font-bold select-none w-24 text-center">
                     {num1} + {num2} =
                   </div>
                   <input
                    type="number"
                    required
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    className="flex-1 px-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-white placeholder:text-industrial-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    placeholder="?"
                  />
                 </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-industrial-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={16} />
            Voltar para Login
          </Link>
        </div>

      </div>
    </div>
  )
}
