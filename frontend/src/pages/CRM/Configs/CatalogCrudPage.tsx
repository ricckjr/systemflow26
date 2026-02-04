import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { Loader2, Plus, Search, Pencil, Trash2, Settings } from 'lucide-react'
import { supabase } from '@/services/supabase'

export type CatalogCrudItem = {
  id: string
  codigo: string | null
  situacao: boolean
  unidade?: string | null
  ncmCodigo?: string | null
  localEstoque?: '03' | '04' | 'PADRAO' | 'INTERNO' | string | null
  familiaId?: string | null
  descricao: string
  preco: number | null
}

type CatalogCrudPayload = Omit<CatalogCrudItem, 'id' | 'codigo'>

type CatalogCrudPageProps = {
  title: string
  subtitle: string
  singularLabel: string
  kind: 'produto' | 'servico'
  accent?: 'cyan' | 'orange' | 'sky'
  fetchItems: () => Promise<CatalogCrudItem[]>
  createItem: (payload: CatalogCrudPayload) => Promise<unknown>
  updateItem: (id: string, payload: CatalogCrudPayload) => Promise<unknown>
  deleteItem: (id: string) => Promise<unknown>
}

const HeaderCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">{children}</div>
)

const ACCENTS: Record<
  NonNullable<CatalogCrudPageProps['accent']>,
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
    primaryBg: 'bg-cyan-600',
    primaryHover: 'hover:bg-cyan-500',
    primaryShadow: 'shadow-cyan-500/15',
    focusRing: 'focus:ring-cyan-500/25',
    focusBorder: 'focus:border-cyan-500/40',
    searchFocusText: 'group-focus-within:text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    iconBorder: 'border-cyan-500/20',
    iconText: 'text-cyan-300'
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

const formatCurrency = (value: number | null) => {
  const num = Number(value ?? 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const parseMoneyInput = (input: string) => {
  const raw = (input || '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  let normalized = cleaned
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = cleaned.replace(',', '.')
  }
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

const formatLocalEstoque = (value: CatalogCrudItem['localEstoque']) => {
  if (value === '04' || value === 'INTERNO') return 'Estoque de Consumo'
  return 'Estoque de Produto (Revenda)'
}

const renderSituacaoBadge = (situacao: boolean) => {
  if (situacao) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
        Ativo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-500/10 text-slate-200 border border-white/10 text-[10px] font-black uppercase tracking-widest">
      Inativo
    </span>
  )
}

export const CatalogCrudPage: React.FC<CatalogCrudPageProps> = ({
  title,
  subtitle,
  singularLabel,
  kind,
  accent = 'cyan',
  fetchItems,
  createItem,
  updateItem,
  deleteItem
}) => {
  const colors = ACCENTS[accent]
  const isProduto = kind === 'produto'

  const [items, setItems] = useState<CatalogCrudItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = useMemo(() => items.find((i) => i.id === activeId) || null, [items, activeId])
  const isEditing = !!active

  const [draftSituacao, setDraftSituacao] = useState(true)
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftPreco, setDraftPreco] = useState('')
  const [draftUnidade, setDraftUnidade] = useState('')
  const [draftNcmCodigo, setDraftNcmCodigo] = useState('')
  const [draftLocalEstoque, setDraftLocalEstoque] = useState<'03' | '04'>('03')
  const [draftFamiliaId, setDraftFamiliaId] = useState('')
  const [draftFamiliaNova, setDraftFamiliaNova] = useState('')
  const [familiaOptions, setFamiliaOptions] = useState<{ familia_id: string; nome: string }[]>([])
  const [familiaLoading, setFamiliaLoading] = useState(false)
  const [familiaSaving, setFamiliaSaving] = useState(false)

  const [ncmSearch, setNcmSearch] = useState('')
  const [ncmOptions, setNcmOptions] = useState<{ codigo: string; descricao: string }[]>([])
  const [ncmLoading, setNcmLoading] = useState(false)
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
      setDraftSituacao(!!active.situacao)
      setDraftDescricao(active.descricao || '')
      setDraftPreco(active.preco === null || active.preco === undefined ? '' : String(active.preco))
      setDraftUnidade(active.unidade || '')
      setDraftNcmCodigo(active.ncmCodigo || '')
      setDraftLocalEstoque(active.localEstoque === '04' || active.localEstoque === 'INTERNO' ? '04' : '03')
      setDraftFamiliaId(active.familiaId || '')
      setDraftFamiliaNova('')
      setNcmSearch(active.ncmCodigo || '')
      return
    }

    setDraftSituacao(true)
    setDraftDescricao('')
    setDraftPreco('')
    setDraftUnidade('UN')
    setDraftNcmCodigo('')
    setDraftLocalEstoque('03')
    setDraftFamiliaId('')
    setDraftFamiliaNova('')
    setNcmSearch('')
    setNcmOptions([])
  }, [isFormOpen, active])

  useEffect(() => {
    if (!isFormOpen) return
    if (!isProduto) return

    const term = ncmSearch.trim()
    if (term.length < 2) {
      setNcmOptions([])
      return
    }

    const handle = setTimeout(async () => {
      setNcmLoading(true)
      try {
        const { data, error: qError } = await supabase
          .from('ncm')
          .select('codigo,descricao')
          .or(`codigo.ilike.%${term}%,descricao.ilike.%${term}%`)
          .order('codigo', { ascending: true })
          .limit(20)

        if (qError) throw qError
        setNcmOptions(((data || []) as any[]).map((row) => ({ codigo: row.codigo, descricao: row.descricao })))
      } catch (e) {
        setNcmOptions([])
      } finally {
        setNcmLoading(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [isFormOpen, isProduto, ncmSearch])

  useEffect(() => {
    if (!isFormOpen) return
    if (!isProduto) return

    let cancelled = false
    const run = async () => {
      setFamiliaLoading(true)
      try {
        const { data, error: qError } = await (supabase as any)
          .from('crm_produtos_familias')
          .select('familia_id,nome')
          .order('nome', { ascending: true })

        if (qError) throw qError
        if (!cancelled) setFamiliaOptions(((data || []) as any[]).map((row) => ({ familia_id: row.familia_id, nome: row.nome })))
      } catch {
        if (!cancelled) setFamiliaOptions([])
      } finally {
        if (!cancelled) setFamiliaLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isFormOpen, isProduto])

  const handleCreateFamilia = async () => {
    const nome = draftFamiliaNova.trim()
    if (!nome) {
      setError('Informe o nome da família.')
      return
    }

    setFamiliaSaving(true)
    setError(null)
    try {
      const { data, error: insError } = await (supabase as any)
        .from('crm_produtos_familias')
        .insert({ nome })
        .select('familia_id,nome')
        .single()

      if (insError) throw insError

      setFamiliaOptions((prev) => {
        const merged = [...prev.filter((p) => p.familia_id !== data.familia_id), data as any]
        merged.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { sensitivity: 'base' }))
        return merged
      })
      setDraftFamiliaId(data.familia_id)
      setDraftFamiliaNova('')
    } catch (e: any) {
      if (String(e?.code || '') === '23505') {
        const { data: existing, error: qError } = await (supabase as any)
          .from('crm_produtos_familias')
          .select('familia_id,nome')
          .ilike('nome', nome)
          .limit(1)
          .maybeSingle()

        if (!qError && existing?.familia_id) {
          setDraftFamiliaId(existing.familia_id)
          setDraftFamiliaNova('')
          return
        }
      }

      setError(e instanceof Error ? e.message : 'Falha ao criar família')
    } finally {
      setFamiliaSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => {
      const parts = [
        i.codigo || '',
        i.descricao || '',
        i.unidade || '',
        i.ncmCodigo || '',
        i.localEstoque || '',
        i.situacao ? 'ativo' : 'inativo'
      ]
      return parts.join(' ').toLowerCase().includes(term)
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

    const payload: CatalogCrudPayload = {
      situacao: draftSituacao,
      descricao,
      preco: parseMoneyInput(draftPreco)
    }

    if (isProduto) {
      const unidade = draftUnidade.trim()
      if (!unidade) {
        setError('A unidade é obrigatória.')
        return
      }

      const ncmDigits = draftNcmCodigo.replace(/\D/g, '')
      if (ncmDigits.length !== 8) {
        setError('O NCM deve ter 8 dígitos.')
        return
      }

      const maskedNcm = `${ncmDigits.slice(0, 4)}.${ncmDigits.slice(4, 6)}.${ncmDigits.slice(6, 8)}`

      payload.unidade = unidade
      payload.ncmCodigo = maskedNcm
      payload.localEstoque = draftLocalEstoque
      payload.familiaId = draftFamiliaId || null
    }

    setSaving(true)
    setError(null)
    try {
      if (activeId) {
        await updateItem(activeId, payload)
      } else {
        await createItem(payload)
      }
      setIsFormOpen(false)
      setActiveId(null)
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
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
          <Settings size={14} className="text-cyan-400" />
          Config Gerais
        </div>
      </div>

      <HeaderCard>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] group">
            <Search
              size={16}
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 ${colors.searchFocusText} transition-colors`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${singularLabel.toLowerCase()}...`}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all`}
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ${colors.primaryBg} ${colors.primaryHover} text-white text-xs font-bold shadow-lg ${colors.primaryShadow} transition-all active:scale-95`}
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
              <Loader2 className="animate-spin text-slate-500" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm font-semibold text-slate-200">Nada por aqui</p>
              <p className="text-sm text-slate-400 mt-1">Crie o primeiro registro para começar.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Código</div>
                <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Situação</div>
                {isProduto && <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Unid.</div>}
                {isProduto && <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">NCM</div>}
                <div className={`${isProduto ? 'col-span-2' : 'col-span-6'} text-[10px] font-black uppercase tracking-widest text-slate-400`}>Descrição</div>
                <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Preço</div>
                {isProduto && <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque</div>}
                <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</div>
              </div>
              <div className="divide-y divide-white/5">
                {filtered.map((i) => (
                  <div
                    key={i.id}
                    className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors"
                  >
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm font-semibold text-slate-200 truncate" title={i.codigo || ''}>
                        {i.codigo || '-'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">#{i.id.split('-')[0]}</div>
                    </div>
                    <div className="col-span-1 min-w-0">{renderSituacaoBadge(!!i.situacao)}</div>
                    {isProduto && (
                      <div className="col-span-1 min-w-0">
                        <div className="text-sm text-slate-300 font-mono truncate">{i.unidade || '-'}</div>
                      </div>
                    )}
                    {isProduto && (
                      <div className="col-span-2 min-w-0">
                        <div className="text-sm text-slate-300 font-mono truncate" title={i.ncmCodigo || ''}>
                          {i.ncmCodigo || '-'}
                        </div>
                      </div>
                    )}
                    <div className={`${isProduto ? 'col-span-2' : 'col-span-6'} min-w-0`}>
                      <div className="text-sm font-semibold text-slate-200 truncate" title={i.descricao}>
                        {i.descricao}
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{formatCurrency(i.preco)}</div>
                    </div>
                    {isProduto && (
                      <div className="col-span-1 min-w-0">
                        <div className="text-xs text-slate-300 truncate">
                          {formatLocalEstoque(i.localEstoque)}
                        </div>
                      </div>
                    )}
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
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !draftDescricao.trim()}
              className={`px-7 py-2.5 rounded-xl ${colors.primaryBg} ${colors.primaryHover} text-white font-bold text-sm shadow-lg ${colors.primaryShadow} disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2`}
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

          <div className={`grid grid-cols-1 ${isEditing ? 'sm:grid-cols-2' : ''} gap-4`}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Situação</label>
              <select
                value={draftSituacao ? 'ATIVO' : 'INATIVO'}
                onChange={(e) => setDraftSituacao(e.target.value === 'ATIVO')}
                className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none`}
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>

            {isEditing && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código</label>
                <input
                  value={active?.codigo || ''}
                  readOnly
                  disabled
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 opacity-80 outline-none placeholder:text-slate-500 font-mono"
                  placeholder="Gerado automaticamente"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição</label>
            <input
              value={draftDescricao}
              onChange={(e) => setDraftDescricao(e.target.value)}
              className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none placeholder:text-slate-500`}
              placeholder={`Ex: ${singularLabel} A`}
              autoFocus
            />
          </div>

          {isProduto && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Unidade</label>
                <select
                  value={draftUnidade}
                  onChange={(e) => setDraftUnidade(e.target.value)}
                  className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none`}
                >
                  <option value="UN">UN</option>
                  <option value="PC">Peça</option>
                  <option value="KG">KG</option>
                  <option value="G">G</option>
                  <option value="L">L</option>
                  <option value="ML">ML</option>
                  <option value="M">M</option>
                  <option value="CM">CM</option>
                  <option value="MM">MM</option>
                  <option value="M2">M²</option>
                  <option value="M3">M³</option>
                  <option value="CX">Caixa</option>
                  <option value="KIT">Kit</option>
                  <option value="PAR">Par</option>
                  <option value="JG">Jogo</option>
                  <option value="FD">Fardo</option>
                  <option value="SC">Saco</option>
                  <option value="T">Ton</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local do Estoque</label>
                <select
                  value={draftLocalEstoque}
                  onChange={(e) => setDraftLocalEstoque(e.target.value === '04' ? '04' : '03')}
                  className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none`}
                >
                  <option value="03">Estoque de Produto (Revenda)</option>
                  <option value="04">Estoque de Consumo</option>
                </select>
              </div>
            </div>
          )}

          {isProduto && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Família</label>
              <select
                value={draftFamiliaId}
                onChange={(e) => setDraftFamiliaId(e.target.value)}
                className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none`}
                disabled={familiaLoading}
              >
                <option value="">{familiaLoading ? 'Carregando...' : 'Selecione (opcional)'}</option>
                {familiaOptions.map((f) => (
                  <option key={f.familia_id} value={f.familia_id}>
                    {f.nome}
                  </option>
                ))}
              </select>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={draftFamiliaNova}
                  onChange={(e) => setDraftFamiliaNova(e.target.value)}
                  className={`flex-1 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none placeholder:text-slate-500`}
                  placeholder="Criar nova família..."
                />
                <button
                  type="button"
                  onClick={handleCreateFamilia}
                  disabled={familiaSaving || !draftFamiliaNova.trim()}
                  className={`px-5 py-3 rounded-xl ${colors.primaryBg} ${colors.primaryHover} text-white text-xs font-bold shadow-lg ${colors.primaryShadow} disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center justify-center gap-2`}
                >
                  {familiaSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Criando...
                    </>
                  ) : (
                    'Incluir'
                  )}
                </button>
              </div>
            </div>
          )}

          {isProduto && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código NCM</label>
              <div className="relative">
                <input
                  value={ncmSearch}
                  onChange={(e) => {
                    const v = e.target.value
                    setNcmSearch(v)
                    setDraftNcmCodigo(v)
                  }}
                  className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none placeholder:text-slate-500 font-mono`}
                  placeholder="0000.00.00"
                />
                {ncmLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Loader2 className="animate-spin" size={16} />
                  </div>
                )}
              </div>

              {ncmOptions.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0B1220] overflow-hidden">
                  <div className="max-h-56 overflow-auto custom-scrollbar">
                    {ncmOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.codigo}
                        onClick={() => {
                          setDraftNcmCodigo(opt.codigo)
                          setNcmSearch(opt.codigo)
                          setNcmOptions([])
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div className="text-sm font-mono text-slate-200">{opt.codigo}</div>
                        <div className="text-xs text-slate-400 truncate">{opt.descricao}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Preço (R$)</label>
            <input
              value={draftPreco}
              onChange={(e) => setDraftPreco(e.target.value)}
              inputMode="decimal"
              className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 ${colors.focusRing} ${colors.focusBorder} transition-all outline-none placeholder:text-slate-500 font-mono`}
              placeholder="Ex: 199,90"
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
          {active && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-sm font-semibold text-slate-100 truncate">{active.descricao}</div>
              <div className="text-xs text-slate-500 font-mono mt-1">{active.codigo || `#${active.id.split('-')[0]}`}</div>
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
