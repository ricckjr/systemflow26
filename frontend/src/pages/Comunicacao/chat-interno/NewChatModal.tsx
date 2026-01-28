import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { Search, UserPlus, MessageSquare, Check } from 'lucide-react'
import type { Profile } from '@/types'

type PresenceMap = Record<string, { status?: string } | undefined>

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
  offline: 'bg-slate-500',
}

export function NewChatModal(props: {
  isOpen: boolean
  onClose: () => void
  users: Profile[]
  currentUserId?: string | null
  usersPresence: PresenceMap
  onOpenProfile: (userId: string) => void
  onStartDirect: (userId: string) => Promise<void>
  onCreateGroup: (input: { name: string; description?: string | null; memberIds: string[] }) => Promise<void>
}) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [search, setSearch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (props.users ?? [])
      .filter((u) => u.id !== props.currentUserId)
      .filter((u) => {
        if (!q) return true
        const name = (u.nome ?? '').toLowerCase()
        const email = (u.email_login ?? '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
  }, [props.currentUserId, props.users, search])

  const reset = () => {
    setMode('direct')
    setSearch('')
    setGroupName('')
    setGroupDescription('')
    setSelectedUserIds(new Set())
    setBusy(false)
  }

  const close = () => {
    if (busy) return
    props.onClose()
    reset()
  }

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={close}
      size="sm"
      noPadding
      title={
        <div className="flex items-center gap-2">
          <UserPlus size={20} className="text-cyan-500" />
          Nova Conversa
        </div>
      }
    >
      <div className="flex flex-col h-[65vh] max-h-[560px]">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-main)]">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                mode === 'direct'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                  : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-main)]',
              ].join(' ')}
            >
              Direto
            </button>
            <button
              type="button"
              onClick={() => setMode('group')}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                mode === 'group'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                  : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-main)]',
              ].join(' ')}
            >
              Grupo
            </button>
          </div>

          {mode === 'group' && (
            <div className="space-y-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nome do grupo"
                className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] outline-none"
                autoFocus
                disabled={busy}
              />
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] outline-none resize-none"
                rows={2}
                disabled={busy}
              />
            </div>
          )}

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === 'direct' ? 'Buscar por nome ou email...' : 'Buscar participantes...'}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] outline-none"
              disabled={busy}
            />
          </div>
          {mode === 'group' && (
            <div className="text-[11px] text-[var(--text-muted)] mt-2">
              Selecionados: {selectedUserIds.size}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[var(--bg-panel)]">
          {filteredUsers.length === 0 ? (
            <div className="text-center p-10 text-[var(--text-muted)] text-sm">Nenhum usuário encontrado.</div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.has(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={async () => {
                      if (busy) return
                      if (mode === 'direct') {
                        setBusy(true)
                        try {
                          await props.onStartDirect(user.id)
                          close()
                        } catch (e: any) {
                          alert(e?.message || 'Não foi possível iniciar a conversa.')
                          setBusy(false)
                        }
                        return
                      }
                      setSelectedUserIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(user.id)) next.delete(user.id)
                        else next.add(user.id)
                        return next
                      })
                    }}
                    className={[
                      'w-full p-3 flex items-center gap-4 rounded-xl border transition-all duration-200 text-left group',
                      mode === 'group' && isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/20'
                        : 'hover:bg-[var(--bg-main)] border-transparent hover:border-[var(--border)]',
                      busy ? 'opacity-70 pointer-events-none' : '',
                    ].join(' ')}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onOpenProfile(user.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          props.onOpenProfile(user.id)
                        }
                      }}
                      className="relative shrink-0"
                      title="Ver perfil"
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.nome}
                          className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] flex items-center justify-center text-white font-bold uppercase text-sm border border-[var(--border)]">
                          {user.nome.substring(0, 2)}
                        </div>
                      )}
                      {props.usersPresence[user.id]?.status && (
                        <div
                          className={[
                            'absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[var(--bg-panel)] rounded-full',
                            STATUS_COLORS[props.usersPresence[user.id]?.status || 'offline'] || STATUS_COLORS.offline,
                          ].join(' ')}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors truncate">
                        {user.nome}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{user.cargo || 'Membro da equipe'}</p>
                    </div>
                    {mode === 'direct' ? (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500 bg-cyan-500/10 p-2 rounded-full">
                        <MessageSquare size={16} />
                      </div>
                    ) : (
                      <div className={['w-5 h-5 rounded-md border', isSelected ? 'bg-cyan-500 border-cyan-400' : 'border-[var(--border)]'].join(' ')}>
                        {isSelected && <Check size={16} className="text-black" />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {mode === 'group' && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-main)]">
            <button
              type="button"
              onClick={async () => {
                if (busy) return
                const name = groupName.trim()
                const description = groupDescription.trim() || null
                const memberIds = Array.from(selectedUserIds.values())
                if (!name) {
                  alert('Informe o nome do grupo.')
                  return
                }
                if (memberIds.length === 0) {
                  alert('Selecione ao menos 1 participante.')
                  return
                }
                setBusy(true)
                try {
                  await props.onCreateGroup({ name, description, memberIds })
                  close()
                } catch (e: any) {
                  alert(e?.message || 'Não foi possível criar o grupo.')
                  setBusy(false)
                }
              }}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={busy || !groupName.trim() || selectedUserIds.size === 0}
            >
              Criar grupo
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
