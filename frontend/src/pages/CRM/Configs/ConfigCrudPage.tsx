import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { Loader2, Plus, Search, Pencil, Trash2, Settings } from 'lucide-react'

export type ConfigCrudItem = {
  id: string
  descricao: string
  obs: string | null
}

type ConfigCrudPageProps = {
  title: string
  subtitle: string
  singularLabel: string
  accent?: 'cyan' | 'orange' | 'sky'
  fetchItems: () => Promise<ConfigCrudItem[]>
  createItem: (payload: Pick<ConfigCrudItem, 'descricao' | 'obs'>) => Promise<unknown>
  updateItem: (id: string, payload: Pick<ConfigCrudItem, 'descricao' | 'obs'>) => Promise<unknown>
  deleteItem: (id: string) => Promise<unknown>
}

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-5">{children}</div>
)

const ACCENTS: Record<
  NonNullable<ConfigCrudPageProps['accent']>,
  {
    primaryBg: string
    primaryHover: string
    primaryShadow: string
    focusRing: string
    focusBorder: string
    searchFocusText: string
    iconBg: string
    iconBorder: string
    iconText: string
  }
> = {
  cyan: {
    primaryBg: 'bg-[var(--primary)]',
    primaryHover: 'hover:bg-[var(--primary)]',
    primaryShadow: 'shadow-cyan-500/15',
    focusRing: 'focus:ring-[var(--primary)]/25',
    focusBorder: 'focus:border-[var(--primary)]/40',
    searchFocusText: 'group-focus-within:text-[var(--primary)]',
    iconBg: 'bg-[var(--primary-soft)]',
    iconBorder: 'border-[var(--primary)]/20',
    iconText: 'text-[var(--primary)]'
  },
  orange: {
    primaryBg: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-500',
    primaryShadow: 'shadow-orange-500/15',
    focusRing: 'focus:ring-orange-500/25',
    focusBorder: 'focus:border-orange-500/40',
    searchFocusText: 'group-focus-within:text-orange-400',
    iconBg: 'bg-orange-500/10',
    iconBorder: 'border-orange-500/20',
    iconText: 'text-orange-300'
  },
  sky: {
    primaryBg: 'bg-sky-600',
    primaryHover: 'hover:bg-sky-500',
    primaryShadow: 'shadow-sky-500/15',
    focusRing: 'focus:ring-sky-500/25',
    focusBorder: 'focus:border-sky-500/40',
    searchFocusText: 'group-focus-within:text-sky-400',
    iconBg: 'bg-sky-500/10',
    iconBorder: 'border-sky-500/20',
    iconText: 'text-sky-300'
  }
}

export const ConfigCrudPage: React.FC<ConfigCrudPageProps> = ({
  title,
  subtitle,
  singularLabel,
  accent = 'cyan',
  fetchItems,
  createItem,
  updateItem,
  deleteItem
}) => {
  const colors = ACCENTS[accent]
  const [items, setItems] = useState<ConfigCrudItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = useMemo(() => items.find(i => i.id === activeId) || null, [items, activeId])
  const isEditing = !!active

  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchItems()
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [fetchItems])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isFormOpen) return
    setError(null)
    if (active) {
      setDraftDescricao(active.descricao || '')
      setDraftObs(active.obs || '')
      return
    }
    setDraftDescricao('')
    setDraftObs('')
  }, [isFormOpen, active])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(i => {
      const a = (i.descricao || '').toLowerCase()
      const c = (i.obs || '').toLowerCase()
      return a.includes(term) || c.includes(term)
    })
  }, [items, search])

  const handleOpenCreate = () => {
    setActiveId(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (id: string) => {
    setActiveId(id)
    setIsFormOpen(true)
  }

  const handleSubmit = async () => {
    const descricao = draftDescricao.trim()
    if (!descricao) {
      setError('A descrição é obrigatória.')
      return
    }
    const payload = {
      descricao,
      obs: draftObs.trim() ? draftObs.trim() : null
    }

    setSaving(true)
    setError(null)
    try {
      if (activeId) {
        await updateItem(activeId, payload)
      } else {
        await createItem(payload)
        setDraftDescricao('')
        setDraftObs('')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleAskDelete = (id: string) => {
    setActiveId(id)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!activeId) return
    setDeleting(true)
    setError(null)
    try {
      await deleteItem(activeId)
      setIsDeleteOpen(false)
      setActiveId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-main)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-soft)]">
          <Settings size={14} className="text-[var(--primary)]" />
          Config Gerais
        </div>
      </div>

      <HeaderCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] group">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] ${colors.searchFocusText} transition-colors`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar ${singularLabel.toLowerCase()}...`}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-soft)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all`}
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ${colors.primaryBg} ${colors.primaryHover} text-white text-xs font-bold ${colors.primaryShadow} transition-all active:scale-95`}
          >
            <Plus size={16} />
            Novo {singularLabel}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
              <p className="text-sm font-semibold text-[var(--text-soft)]">Nada por aqui</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Crie o primeiro registro para começar.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border)]">
                <div className="col-span-6 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Descrição</div>
                <div className="col-span-5 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Observação</div>
                <div className="col-span-1 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Ações</div>
              </div>
              <div className="divide-y divide-white/5">
                {filtered.map(i => (
                  <div key={i.id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)] transition-colors">
                    <div className="col-span-6 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-soft)] truncate" title={i.descricao}>
                        {i.descricao}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">#{i.id.split('-')[0]}</div>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <div className="text-sm text-[var(--text-muted)] truncate">{i.obs || '-'}</div>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(i.id)}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] border border-transparent hover:border-[var(--primary)]/20 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAskDelete(i.id)}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </HeaderCard>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (saving) return
          setIsFormOpen(false)
          setActiveId(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${colors.iconBg} border ${colors.iconBorder} flex items-center justify-center`}>
              <Settings size={16} className={colors.iconText} />
            </div>
            {isEditing ? `Editar ${singularLabel}` : `Novo ${singularLabel}`}
          </div>
        }
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                if (saving) return
                setIsFormOpen(false)
                setActiveId(null)
              }}
              className="px-6 py-2.5 rounded-xl text-[var(--text-soft)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)] disabled:opacity-50 disabled:pointer-events-none"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !draftDescricao.trim()}
              className={`px-7 py-2.5 rounded-xl ${colors.primaryBg} ${colors.primaryHover} text-white font-bold text-sm ${colors.primaryShadow} disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2`}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Descrição</label>
            <input
              value={draftDescricao}
              onChange={e => setDraftDescricao(e.target.value)}
              className={`w-full rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none placeholder:text-[var(--text-muted)]`}
              placeholder={`Ex: ${singularLabel} A`}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Observação (opcional)</label>
            <textarea
              value={draftObs}
              onChange={e => setDraftObs(e.target.value)}
              className={`w-full h-28 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none resize-none placeholder:text-[var(--text-muted)]`}
              placeholder="Notas internas, regras, classificação..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (deleting) return
          setIsDeleteOpen(false)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Trash2 size={16} className="text-rose-300" />
            </div>
            Excluir {singularLabel}
          </div>
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="px-6 py-2.5 rounded-xl text-[var(--text-soft)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)] disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-7 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-rose-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-soft)]">Essa ação não pode ser desfeita.</p>
          {active && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--text-main)] truncate">{active.descricao}</div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-1">#{active.id.split('-')[0]}</div>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
