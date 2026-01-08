import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import {
  Upload,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react'

type FormState = {
  nome: string
  email_corporativo: string
  telefone: string
  ramal: string
  avatar_url: string
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] uppercase tracking-widest font-medium text-[var(--text-soft)] mb-1">
    {children}
  </label>
)

export default function Perfil() {
  const { profile: contextProfile, refreshProfile, session, loading } = useAuth()

  /* ===========================
     PROFILE FALLBACK
  ============================ */
  const profile = useMemo(() => {
    if (contextProfile) return contextProfile
    if (session?.user) {
      return {
        id: session.user.id,
        nome: '',
        email_login: session.user.email || '',
        avatar_url: '',
        email_corporativo: '',
        telefone: '',
        ramal: '',
        role: 'user',
        status: 'online',
        ativo: true,
        created_at: new Date().toISOString(),
      } as any
    }
    return null
  }, [contextProfile, session])

  /* ===========================
     STATE
  ============================ */
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

  /* ===========================
     SYNC PROFILE
  ============================ */
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

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  const isDirty = useMemo(() => {
    if (!profile) return false
    return (
      form.nome !== (profile.nome || '') ||
      form.email_corporativo !== (profile.email_corporativo || '') ||
      form.telefone !== (profile.telefone || '') ||
      form.ramal !== (profile.ramal || '') ||
      avatarFile !== null
    )
  }, [form, profile, avatarFile])

  /* ===========================
     LOAD STATE
  ============================ */
  if (loading && !profile) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center text-[var(--text-soft)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mb-2" />
        <p className="text-sm">Carregando perfil…</p>
      </div>
    )
  }

  if (!profile) return null

  /* ===========================
     HELPERS (INALTERADOS)
  ============================ */
  const isValidEmail = (v: string) =>
    !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const isValidImage = async (file: File) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) return false
    if (file.size > 3 * 1024 * 1024) return false
    const buffer = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return (
      (buffer[0] === 0x89 && buffer[1] === 0x50) ||
      (buffer[0] === 0xff && buffer[1] === 0xd8)
    )
  }

  const getStoragePathFromUrl = (url?: string | null) =>
    url ? url.split('/').pop() || null : null

  /* ===========================
     ACTIONS (INALTERADAS)
  ============================ */
  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const valid = await isValidImage(file)
      if (!valid) throw new Error('Imagem inválida. Use JPG ou PNG até 3MB.')

      if (profile.avatar_url) {
        const old = getStoragePathFromUrl(profile.avatar_url)
        if (old) await supabase.storage.from('avatars').remove([old])
      }

      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `avatars/${profile.id}-${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (error) throw error

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
    if (!isValidEmail(form.email_corporativo))
      return setError('E-mail corporativo inválido.')

    setSaving(true)

    try {
      let avatarUrl = form.avatar_url
      if (avatarFile) avatarUrl = await uploadAvatar(avatarFile)

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          nome: form.nome.trim(),
          email_corporativo: form.email_corporativo || null,
          telefone: form.telefone || null,
          ramal: form.ramal || null,
          avatar_url: avatarUrl || null,
          email_login: profile.email_login,
          updated_at: new Date().toISOString(),
        } as any)

      if (error) throw error

      await refreshProfile()
      setAvatarFile(null)
      setAvatarPreview(avatarUrl || '')
      setSuccess(true)
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

    if (newPassword.length < 6)
      return setPasswordError('A senha deve ter no mínimo 6 caracteres.')
    if (newPassword !== confirmPassword)
      return setPasswordError('As senhas não coincidem.')

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
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

  /* ===========================
     UI
  ============================ */
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-[18px] font-semibold">Meu Perfil</h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            Informações pessoais e segurança
          </p>
        </div>
      </div>

      {/* PROFILE CARD */}
      <div className="card-panel">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-semibold">Informações pessoais</h2>
          {isDirty && (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
              Alterações não salvas
            </span>
          )}
        </div>

        <form onSubmit={handleProfileUpdate} className="space-y-6">
          {/* AVATAR */}
          <div className="flex items-center gap-6 pb-6 border-b border-[var(--border)]">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-[var(--bg-panel)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold text-[var(--text-soft)]">
                    {(form.nome || 'U')[0]}
                  </span>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" />
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 cursor-pointer text-sm">
              <Upload size={16} />
              Alterar foto
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
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

          {/* FEEDBACK */}
          {error && (
            <div className="alert alert-error">{error}</div>
          )}
          {success && (
            <div className="alert alert-success flex items-center gap-2">
              <CheckCircle2 size={16} />
              Perfil atualizado com sucesso
            </div>
          )}

          {/* FIELDS */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <Label>Nome completo</Label>
              <input
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                className="input-primary"
                disabled={saving}
              />
            </div>

            <div>
              <Label>E-mail de login</Label>
              <input
                value={profile.email_login}
                readOnly
                className="input-primary opacity-50 cursor-not-allowed"
              />
            </div>

            <div>
              <Label>E-mail corporativo</Label>
              <input
                type="email"
                value={form.email_corporativo}
                onChange={e =>
                  setForm({ ...form, email_corporativo: e.target.value })
                }
                className="input-primary"
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <input
                value={form.telefone}
                onChange={e => setForm({ ...form, telefone: e.target.value })}
                className="input-primary"
              />
            </div>

            <div>
              <Label>Ramal</Label>
              <input
                value={form.ramal}
                onChange={e => setForm({ ...form, ramal: e.target.value })}
                className="input-primary"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={!isDirty || saving}
              className="btn-primary"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* SECURITY */}
      <div className="card-panel">
        <h2 className="font-semibold mb-4">Segurança</h2>

        {passwordError && (
          <div className="alert alert-error">{passwordError}</div>
        )}
        {passwordSuccess && (
          <div className="alert alert-success">
            Senha atualizada com sucesso
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6 mt-4">
          <div>
            <Label>Nova senha</Label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <Label>Confirmar senha</Label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input-primary"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="btn-primary"
          >
            {changingPassword ? 'Atualizando…' : 'Atualizar senha'}
          </button>
        </div>
      </div>
    </div>
  )
}
