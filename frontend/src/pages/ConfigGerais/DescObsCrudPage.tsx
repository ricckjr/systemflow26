import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { Loader2, Plus, Search, Pencil, Trash2, Settings } from 'lucide-react'

export type DescObsCrudItem = {
  id: string
  descricao: string
  observacao: string | null
}

type DescObsCrudPageProps = {
  title: string
  subtitle: string
  singularLabel: string
  fetchItems: () => Promise<DescObsCrudItem[]>
  createItem: (payload: Pick<DescObsCrudItem, 'descricao' | 'observacao'>) => Promise<unknown>
  updateItem: (id: string, payload: Pick<DescObsCrudItem, 'descricao' | 'observacao'>) => Promise<unknown>
  deleteItem: (id: string) => Promise<unknown>
}

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">{children}</div>
)

export const DescObsCrudPage: React.FC<DescObsCrudPageProps> = ({
  title,
  subtitle,
  singularLabel,
  fetchItems,
  createItem,
  updateItem,
  deleteItem
}) => {
  const [items, setItems] = useState<DescObsCrudItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(() => items.find((i) => i.id === activeId) || null, [items, activeId])

  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftObservacao, setDraftObservacao] = useState('')
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
      setDraftObservacao(active.observacao || '')
      return
    }
    setDraftDescricao('')
    setDraftObservacao('')
  }, [isFormOpen, active])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => {
      const a = (i.descricao || '').toLowerCase()
      const b = (i.observacao || '').toLowerCase()
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

  const handleAskDelete = (id: string) => {
    setActiveId(id)
    setIsDeleteOpen(true)
  }

  const handleSubmit = async () => {
    const descricao = draftDescricao.trim()
    if (!descricao) {
      setError('A descrição é obrigatória.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        descricao,
        observacao: draftObservacao.trim() ? draftObservacao.trim() : null
      }
      if (activeId) await updateItem(activeId, payload)
      else await createItem(payload)
      setIsFormOpen(false)
      setActiveId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
          <Settings size={14} className="text-cyan-400" />
          Financeiro
        </div>
      </div>

      <HeaderCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${singularLabel.toLowerCase()}...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/15 transition-all active:scale-95"
          >
            <Plus size={16} />
            Novo {singularLabel}
          </button>
        </div>
      </HeaderCard>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-slate-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm font-semibold text-slate-200">Nenhum registro encontrado</p>
          <p className="text-sm text-slate-400 mt-1">Crie o primeiro cadastro para começar.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
            <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição</div>
            <div className="col-span-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Observação</div>
            <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</div>
          </div>
          <div className="divide-y divide-white/5">
            {filtered.map((i) => (
              <div key={i.id} className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors">
                <div className="col-span-5 min-w-0">
                  <div className="text-sm text-slate-200 truncate">{i.descricao}</div>
                </div>
                <div className="col-span-6 min-w-0">
                  <div className="text-sm text-slate-300 truncate">{i.observacao || '-'}</div>
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(i.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskDelete(i.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
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

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (saving) return
          setIsFormOpen(false)
          setActiveId(null)
        }}
        title={activeId ? `Editar ${singularLabel}` : `Novo ${singularLabel}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
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
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição</label>
            <input
              value={draftDescricao}
              onChange={(e) => setDraftDescricao(e.target.value)}
              className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              placeholder="Descrição"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observação</label>
            <input
              value={draftObservacao}
              onChange={(e) => setDraftObservacao(e.target.value)}
              className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              placeholder="Opcional"
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
        title={`Excluir ${singularLabel}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-7 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
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
          <p className="text-sm text-slate-300">Essa ação não pode ser desfeita.</p>
        </div>
      </Modal>
    </div>
  )
}

