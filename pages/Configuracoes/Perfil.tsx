import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabaseClient'
import { Upload, ShieldCheck, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'

type FormState = {
  nome: string
  email_corporativo: string
  telefone: string
  ramal: string
  avatar_url: string
}

const InputClasses = "w-full px-4 py-2.5 border border-industrial-border bg-industrial-bg rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-white placeholder:text-industrial-text-secondary transition-all"
const LabelClasses = "block text-xs font-bold text-industrial-text-secondary uppercase mb-1.5 ml-1"

export default function Perfil() {
  const { profile, refreshProfile } = useAuth()

  const [form, setForm] = useState<FormState>({
    nome: '',
    email_corporativo: '',
    telefone: '',
    ramal: '',
    avatar_url: '',
  })

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // ============================
  // Sync profile
  // ============================
  useEffect(() => {
    if (!profile) return
    setForm({
      nome: profile.nome || '',
      email_corporativo: profile.email_corporativo || '',
      telefone: profile.telefone || '',
      ramal: profile.ramal || '',
      avatar_url: profile.avatar_url || '',
    })
    setAvatarPreview(profile.avatar_url || '')
  }, [profile])

  // Prevent memory leak
  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  if (!profile) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-industrial-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-500" />
        <p className="text-sm font-medium">Carregando perfil...</p>
      </div>
    )
  }

  // ============================
  // Validators
  // ============================
  const isValidEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const isDirty = useMemo(() => {
    return (
      form.nome !== (profile.nome || '') ||
      form.email_corporativo !== (profile.email_corporativo || '') ||
      form.telefone !== (profile.telefone || '') ||
      form.ramal !== (profile.ramal || '') ||
      avatarFile !== null
    )
  }, [form, profile, avatarFile])

  const isValidImage = async (file: File) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) return false
    if (file.size > 3 * 1024 * 1024) return false // 3MB
    const buffer = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return (buffer[0] === 0x89 && buffer[1] === 0x50) || (buffer[0] === 0xff && buffer[1] === 0xd8)
  }

  const getStoragePathFromUrl = (url?: string | null) => {
    if (!url) return null
    return url.split('/').pop() || null
  }

  // ============================
  // Actions
  // ============================
  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const valid = await isValidImage(file)
      if (!valid) throw new Error('Imagem inválida. Use JPG ou PNG de até 3MB.')

      if (profile.avatar_url) {
        const old = getStoragePathFromUrl(profile.avatar_url)
        if (old) await supabase.storage.from('avatars').remove([old])
      }

      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `avatars/${profile.id}-${Date.now()}.${ext}`
      
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      })
      if (upErr) throw upErr

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !isDirty) return

    setError(null)
    setSuccess(false)

    if (!form.nome.trim()) return setError('O nome é obrigatório.')
    if (!isValidEmail(form.email_corporativo)) return setError('E-mail corporativo inválido.')

    setSaving(true)

    try {
      let avatarUrl = form.avatar_url

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile)
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          email_corporativo: form.email_corporativo || null,
          telefone: form.telefone || null,
          ramal: form.ramal || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      setAvatarFile(null)
      setAvatarPreview(avatarUrl || '')
      setSuccess(true)
      
      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (changingPassword) return

    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) return setPasswordError('A senha deve ter no mínimo 6 caracteres.')
    if (newPassword !== confirmPassword) return setPasswordError('As senhas digitadas não coincidem.')

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao atualizar senha.')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 text-brand-500 flex items-center justify-center">
           <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-none">Meu Perfil</h1>
          <p className="text-industrial-text-secondary text-sm mt-1">Gerencie suas informações pessoais e segurança</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-industrial-surface rounded-2xl shadow-lg border border-industrial-border overflow-hidden">
        <div className="p-6 border-b border-industrial-border flex justify-between items-center bg-industrial-bg/30">
          <h2 className="text-lg font-bold text-white">Informações Pessoais</h2>
          {isDirty && <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20">Alterações não salvas</span>}
        </div>

        <form onSubmit={handleProfileUpdate} className="p-6 space-y-8">
          
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-industrial-border border-dashed">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-industrial-bg border-2 border-industrial-border overflow-hidden flex items-center justify-center shadow-2xl">
                {avatarPreview ? (
                  <img src={avatarPreview} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <span className="text-2xl font-bold text-industrial-text-secondary">{(form.nome || 'U')[0]}</span>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-3">
              <div>
                <h3 className="text-white font-bold text-sm">Foto de Perfil</h3>
                <p className="text-industrial-text-secondary text-xs mt-1">Recomendado: JPG ou PNG, máx 3MB.</p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-industrial-border bg-industrial-bg hover:bg-white/5 text-sm font-bold text-white cursor-pointer transition-colors shadow-sm">
                <Upload size={16} className="text-brand-400" />
                <span>{uploadingAvatar ? 'Enviando...' : 'Alterar foto'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={uploadingAvatar || saving}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setAvatarFile(f)
                    setAvatarPreview(URL.createObjectURL(f))
                  }}
                />
              </label>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={18} />
              Perfil atualizado com sucesso!
            </div>
          )}

          {/* Fields Grid */}
          <div className="grid gap-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className={LabelClasses}>Nome Completo</label>
                <input 
                  value={form.nome} 
                  onChange={e => setForm({ ...form, nome: e.target.value })} 
                  placeholder="Seu nome completo" 
                  className={InputClasses} 
                  disabled={saving}
                />
              </div>
              <div>
                <label className={LabelClasses}>E-mail de Login <span className="text-[10px] opacity-50 ml-1 font-normal normal-case">(Não editável)</span></label>
                <input 
                  value={profile.email_login} 
                  readOnly 
                  className={`${InputClasses} opacity-50 cursor-not-allowed bg-industrial-bg/50`} 
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className={LabelClasses}>E-mail Corporativo</label>
                <input 
                  type="email"
                  value={form.email_corporativo} 
                  onChange={e => setForm({ ...form, email_corporativo: e.target.value })} 
                  placeholder="nome@empresa.com.br" 
                  className={InputClasses} 
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className={LabelClasses}>Telefone</label>
                <input 
                  value={form.telefone} 
                  onChange={e => setForm({ ...form, telefone: e.target.value })} 
                  placeholder="(00) 00000-0000" 
                  className={InputClasses} 
                  disabled={saving}
                />
              </div>
              <div>
                <label className={LabelClasses}>Ramal</label>
                <input 
                  value={form.ramal} 
                  onChange={e => setForm({ ...form, ramal: e.target.value })} 
                  placeholder="000" 
                  className={InputClasses} 
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-industrial-border">
             <button 
              type="submit"
              disabled={!isDirty || saving || uploadingAvatar} 
              className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="bg-industrial-surface rounded-2xl shadow-lg border border-industrial-border overflow-hidden">
        <div className="p-6 border-b border-industrial-border bg-industrial-bg/30">
          <h2 className="text-lg font-bold text-white">Segurança</h2>
          <p className="text-industrial-text-secondary text-xs mt-1">Atualize sua senha de acesso periodicamente</p>
        </div>
        
        <div className="p-6 space-y-6">
          {passwordError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center gap-3">
              <CheckCircle2 size={18} />
              Senha atualizada com sucesso!
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={LabelClasses}>Nova Senha</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Mínimo 6 caracteres" 
                  className={`${InputClasses} pr-10`} 
                  disabled={changingPassword}
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
            <div>
              <label className={LabelClasses}>Confirmar Senha</label>
              <input 
                type={showPassword ? "text" : "password"}
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Repita a nova senha" 
                className={InputClasses} 
                disabled={changingPassword}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !newPassword || !confirmPassword} 
              className="px-6 py-3 border border-industrial-border hover:bg-industrial-bg text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {changingPassword ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {changingPassword ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
