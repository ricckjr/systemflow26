import React from 'react'
import {
  Upload,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Bell,
  MessageSquare,
} from 'lucide-react'
import { useProfileForm } from '@/hooks/useProfileForm'
import { useNotificationPreferences } from '@/contexts/useNotificationPreferences'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] uppercase tracking-widest font-medium text-[var(--text-soft)] mb-1">
    {children}
  </label>
)

const ToggleRow = ({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}) => {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--text-main)]">{title}</div>
        <div className="mt-0.5 text-[12px] text-[var(--text-soft)]">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
          enabled
            ? 'border-cyan-500/25 bg-cyan-600 text-white hover:bg-cyan-500'
            : 'border-[var(--border)] bg-white/5 text-[var(--text-soft)] hover:bg-white/10 hover:text-[var(--text-main)]'
        }`}
      >
        {enabled ? 'Ativo' : 'Desativado'}
      </button>
    </div>
  )
}

export default function Perfil() {
  const {
    form,
    profile,
    emailLogin,
    authLoading,
    isDirty,
    avatarPreview,
    saving,
    uploadingAvatar,
    success,
    error,
    newPassword,
    confirmPassword,
    showPassword,
    changingPassword,
    passwordSuccess,
    passwordError,
    setForm,
    setNewPassword,
    setConfirmPassword,
    setShowPassword,
    handleAvatarChange,
    saveProfile,
    changePassword
  } = useProfileForm()
  const { preferences, setChannelPreferences } = useNotificationPreferences()
  const { modal: unsavedChangesModal } = useUnsavedChangesGuard({
    when: isDirty && !saving && !uploadingAvatar,
    onSave: () => saveProfile(),
  })

  /* ===========================
     LOADING STATE
  ============================ */
  if (authLoading && !profile && !emailLogin) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center text-[var(--text-soft)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mb-2" />
        <p className="text-sm">Carregando perfil…</p>
      </div>
    )
  }

  if (!profile && !emailLogin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-semibold mb-2">Não foi possível carregar seu perfil</h2>
        <p className="text-[var(--text-soft)] mb-6 max-w-md">
          Isso pode ter ocorrido por uma falha de conexão. Tente recarregar a página.
        </p>
      </div>
    )
  }

  /* ===========================
     UI RENDER
  ============================ */
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
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

        <form onSubmit={saveProfile} className="space-y-6">
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

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-white/5 cursor-pointer text-sm transition-colors">
              <Upload size={16} />
              Alterar foto
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                disabled={uploadingAvatar || saving}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleAvatarChange(f)
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
                placeholder="Seu nome"
              />
            </div>

            <div>
              <Label>E-mail de login</Label>
              <input
                value={emailLogin || ''}
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
                placeholder="nome@empresa.com"
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <input
                value={form.telefone}
                onChange={e => setForm({ ...form, telefone: e.target.value })}
                className="input-primary"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label>Ramal</Label>
              <input
                value={form.ramal}
                onChange={e => setForm({ ...form, ramal: e.target.value })}
                className="input-primary"
                placeholder="0000"
              />
            </div>

            <div>
              <Label>Cargo</Label>
              <div className="input-primary opacity-50 cursor-not-allowed flex items-center h-[42px]">
                  {profile?.cargo || 'Sem Cargo Definido'}
              </div>
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
      {unsavedChangesModal}

      {/* SECURITY */}
      <div className="card-panel">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold">Notificações</h2>
            <p className="text-[13px] text-[var(--text-soft)]">Preferências separadas para Sistema e Mensagens</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            <Bell size={14} className="text-cyan-400" />
            Sistema
          </div>
          <ToggleRow
            title="Som de alertas do sistema"
            description="Toca um alerta sutil ao chegar uma notificação do sininho."
            enabled={preferences.system.soundEnabled}
            onToggle={() =>
              void setChannelPreferences('system', { soundEnabled: !preferences.system.soundEnabled })
            }
          />

          <div className="pt-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            <MessageSquare size={14} className="text-cyan-400" />
            Mensagens
          </div>
          <ToggleRow
            title="Som de mensagens"
            description="Toca um som sutil ao receber novas mensagens no chat."
            enabled={preferences.chat.soundEnabled}
            onToggle={() => void setChannelPreferences('chat', { soundEnabled: !preferences.chat.soundEnabled })}
          />
        </div>
      </div>

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
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)] hover:text-[var(--text-main)]"
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
              placeholder="Confirme a nova senha"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={changePassword}
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
