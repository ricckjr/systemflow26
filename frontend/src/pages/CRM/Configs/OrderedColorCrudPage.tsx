import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { Loader2, Plus, Search, Pencil, Trash2, Settings } from 'lucide-react'

export type OrderedColorItem = {
  id: string
  descricao: string
  obs: string | null
  ordem: number
  cor: string | null
}

type OrderedColorCrudPageProps = {
  title: string
  subtitle: string
  singularLabel: string
  fetchItems: () => Promise<OrderedColorItem[]>
  createItem: (payload: Omit<OrderedColorItem, 'id'>) => Promise<unknown>
  updateItem: (id: string, payload: Omit<OrderedColorItem, 'id'>) => Promise<unknown>
  deleteItem: (id: string) => Promise<unknown>
}

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-5">{children}</div>
)

const normalizeHex = (value: string) => {
  const v = (value || '').trim()
  if (!v) return ''
  const withHash = v.startsWith('#') ? v : `#${v}`
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toLowerCase()
  return v
}

export const OrderedColorCrudPage: React.FC<OrderedColorCrudPageProps> = ({
  title,
  subtitle,
  singularLabel,
  fetchItems,
  createItem,
  updateItem,
  deleteItem
}) => {
  const [items, setItems] = useState<OrderedColorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = useMemo(() => items.find((i) => i.id === activeId) || null, [items, activeId])
  const isEditing = !!active

  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [draftOrdem, setDraftOrdem] = useState('0')
  const [draftCor, setDraftCor] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchItems()
      setItems(data.slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.descricao.localeCompare(b.descricao)))
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
      setDraftOrdem(String(active.ordem ?? 0))
      setDraftCor(active.cor || '')
      return
    }
    setDraftDescricao('')
    setDraftObs('')
    setDraftOrdem('0')
    setDraftCor('')
  }, [isFormOpen, active])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => {
      const a = (i.descricao || '').toLowerCase()
      const b = (i.obs || '').toLowerCase()
      return a.includes(term) || b.includes(term)
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

    const ordemValue = Number(draftOrdem)
    const ordem = Number.isFinite(ordemValue) ? Math.trunc(ordemValue) : 0
    const cor = normalizeHex(draftCor)
    const payload = {
      descricao,
      obs: draftObs.trim() ? draftObs.trim() : null,
      ordem,
      cor: cor ? cor : null
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
        setDraftOrdem('0')
        setDraftCor('')
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${singularLabel.toLowerCase()}...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-soft)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)] text-white text-xs font-bold shadow-cyan-500/15 transition-all active:scale-95"
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
                <div className="col-span-5 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Descrição</div>
                <div className="col-span-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Ordem</div>
                <div className="col-span-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Cor</div>
                <div className="col-span-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Observação</div>
                <div className="col-span-1 text-xs font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Ações</div>
              </div>
              <div className="divide-y divide-white/5">
                {filtered
                  .slice()
                  .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.descricao.localeCompare(b.descricao))
                  .map((i) => (
                    <div key={i.id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)] transition-colors">
                      <div className="col-span-5 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-soft)] truncate" title={i.descricao}>
                          {i.descricao}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">#{i.id.split('-')[0]}</div>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <div className="text-sm text-[var(--text-soft)] truncate">{i.ordem}</div>
                      </div>
                      <div className="col-span-2 min-w-0 flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border border-[var(--border)]"
                          style={{ backgroundColor: i.cor || '#94a3b8' }}
                        />
                        <div className="text-xs text-[var(--text-soft)] font-mono truncate">{i.cor || '-'}</div>
                      </div>
                      <div className="col-span-2 min-w-0">
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
            <div className="w-8 h-8 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center">
              <Settings size={16} className="text-[var(--primary)]" />
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
              className="px-7 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)] text-white font-bold text-sm shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
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
              onChange={(e) => setDraftDescricao(e.target.value)}
              className="w-full rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all outline-none placeholder:text-[var(--text-muted)]"
              placeholder={`Ex: ${singularLabel} A`}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Ordem (0 = automático)</label>
              <input
                value={draftOrdem}
                onChange={(e) => setDraftOrdem(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all outline-none placeholder:text-[var(--text-muted)]"
                placeholder="Ex: 10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Cor (hex)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(draftCor) || '#94a3b8'}
                  onChange={(e) => setDraftCor(e.target.value)}
                  className="h-12 w-14 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-2"
                />
                <input
                  value={draftCor}
                  onChange={(e) => setDraftCor(e.target.value)}
                  className="w-full rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all outline-none placeholder:text-[var(--text-muted)] font-mono"
                  placeholder="#22d3ee"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Observação (opcional)</label>
            <textarea
              value={draftObs}
              onChange={(e) => setDraftObs(e.target.value)}
              className="w-full h-28 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 transition-all outline-none resize-none placeholder:text-[var(--text-muted)]"
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
