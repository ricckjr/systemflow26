import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/services/supabase'

type ProfileFormState = {
  nome: string
  email_corporativo: string
  telefone: string
  ramal: string
  avatar_url: string
}

const emptyForm: ProfileFormState = {
  nome: '',
  email_corporativo: '',
  telefone: '',
  ramal: '',
  avatar_url: '',
}

function toFormState(profile: any): ProfileFormState {
  if (!profile) return emptyForm
  return {
    nome: profile.nome ?? '',
    email_corporativo: profile.email_corporativo ?? '',
    telefone: profile.telefone ?? '',
    ramal: profile.ramal ?? '',
    avatar_url: profile.avatar_url ?? '',
  }
}

function sameForm(a: ProfileFormState, b: ProfileFormState) {
  return (
    a.nome === b.nome &&
    a.email_corporativo === b.email_corporativo &&
    a.telefone === b.telefone &&
    a.ramal === b.ramal &&
    a.avatar_url === b.avatar_url
  )
}

export function useProfileForm() {
  const { session, profile, authReady, profileReady, refreshProfile } = useAuth()

  const [form, setForm] = useState<ProfileFormState>(emptyForm)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const baselineRef = useRef<ProfileFormState>(emptyForm)
  const baselineProfileIdRef = useRef<string | null>(null)

  const userId = profile?.id ?? session?.user?.id ?? null
  const emailLogin = profile?.email_login ?? session?.user?.email ?? ''

  useEffect(() => {
    if (!profileReady) return

    const nextBaseline = toFormState(profile)
    const nextProfileId = profile?.id ?? null
    const prevBaseline = baselineRef.current
    const sameIdentity = baselineProfileIdRef.current === nextProfileId

    setForm(prev => {
      const prevMatchesBaseline = sameForm(prev, prevBaseline)
      if (!sameIdentity || prevMatchesBaseline) {
        return sameForm(prev, nextBaseline) ? prev : nextBaseline
      }
      return prev
    })

    baselineRef.current = nextBaseline
    baselineProfileIdRef.current = nextProfileId

    if (!profile) {
      setAvatarFile(null)
      setAvatarPreview('')
      return
    }

    setAvatarPreview(prev => (prev?.startsWith('blob:') ? prev : (profile.avatar_url ?? '')))
  }, [profileReady, profile])

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  const isDirty = useMemo(() => {
    if (!profileReady) return false

    return (
      form.nome !== (profile?.nome ?? '') ||
      form.email_corporativo !== (profile?.email_corporativo ?? '') ||
      form.telefone !== (profile?.telefone ?? '') ||
      form.ramal !== (profile?.ramal ?? '') ||
      (avatarFile !== null) ||
      form.avatar_url !== (profile?.avatar_url ?? '')
    )
  }, [form, profile, profileReady, avatarFile])

  const authLoading = !authReady || (session && !profileReady)

  const handleAvatarChange = useCallback((file: File) => {
    setAvatarFile(file)
    setAvatarPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }, [])

  const uploadAvatar = useCallback(async (file: File) => {
    if (!userId) throw new Error('Usuário não identificado')
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      throw new Error('Imagem inválida. Use JPG ou PNG.')
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('Imagem muito grande. Máximo 3MB.')
    }

    setUploadingAvatar(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `avatars/${userId}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setUploadingAvatar(false)
    }
  }, [userId])

  const saveProfile = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!profileReady) return false
    if (!userId) return false
    if (savingRef.current) return false

    setError(null)
    setSuccess(false)
    setSaving(true)
    savingRef.current = true

    try {
      let avatarUrl = form.avatar_url
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile)
      }

      if (!emailLogin) {
        throw new Error('E-mail de login não disponível')
      }

      const nome = form.nome.trim() || profile?.nome || 'Novo Usuário'

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          nome,
          email_corporativo: form.email_corporativo || null,
          telefone: form.telefone || null,
          ramal: form.ramal || null,
          avatar_url: avatarUrl || null,
          email_login: emailLogin,
          updated_at: new Date().toISOString(),
        } as any)

      if (error) throw error

      await refreshProfile()
      setAvatarFile(null)
      setAvatarPreview(avatarUrl || '')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      return true
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar alterações.')
      return false
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }, [avatarFile, emailLogin, form, profile?.nome, profileReady, refreshProfile, uploadAvatar, userId])

  const changePassword = useCallback(async () => {
    if (changingPassword) return

    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.')
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err?.message || 'Erro ao atualizar senha.')
    } finally {
      setChangingPassword(false)
    }
  }, [changingPassword, confirmPassword, newPassword])

  return {
    form,
    setForm,
    profile,
    authLoading,
    isDirty,
    saving,
    profileReady,
    avatarPreview,
    uploadingAvatar,
    success,
    error,
    newPassword,
    confirmPassword,
    showPassword,
    changingPassword,
    passwordSuccess,
    passwordError,
    setNewPassword,
    setConfirmPassword,
    setShowPassword,
    handleAvatarChange,
    saveProfile,
    changePassword,
    emailLogin,
  }
}
