import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, ChevronDown, Loader2, Pencil, Plus, Search } from 'lucide-react'
import { createCrmProduto, fetchCrmProdutos, updateCrmProduto, type CRM_Produto } from '@/services/crm'
import { supabase } from '@/services/supabase'
import { api } from '@/services/api'
import { Modal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'

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

const formatUnknownError = (err: unknown) => {
  if (err instanceof Error) return err.message || 'Erro'
  if (typeof err === 'string') return err || 'Erro'
  if (!err || typeof err !== 'object') return 'Erro'
  const anyErr = err as any
  const message =
    typeof anyErr?.message === 'string'
      ? anyErr.message
      : typeof anyErr?.error_description === 'string'
        ? anyErr.error_description
        : typeof anyErr?.error === 'string'
          ? anyErr.error
          : ''
  const details = typeof anyErr?.details === 'string' ? anyErr.details : ''
  const hint = typeof anyErr?.hint === 'string' ? anyErr.hint : ''
  const code = typeof anyErr?.code === 'string' ? anyErr.code : ''
  const status = typeof anyErr?.status === 'number' ? String(anyErr.status) : ''
  const parts = [message, details, hint].map((p) => String(p || '').trim()).filter(Boolean)
  const base = parts[0] || 'Erro'
  const extra = parts.slice(1).join(' — ')
  const meta = [code ? `code=${code}` : '', status ? `status=${status}` : ''].filter(Boolean).join(' ')
  return [base, extra].filter(Boolean).join(' — ') + (meta ? ` (${meta})` : '')
}

type MovimentoTipo = 'Entrada' | 'Saida' | 'Ajuste' | 'Transferencia'

type MovimentoEstoque = {
  mov_id: string
  prod_id: string
  tipo_movimentacao: 'Entrada' | 'Saida' | 'Ajuste' | 'Transferencia'
  data_movimentacao: string
  local_estoque: string
  quantidade: number
  motivo: string | null
  user_id: string | null
}

type LocalEstoque = {
  local_id: string
  nome: string
  ativo: boolean
}

type ProdutoInfoTab = 'detalhada' | 'local' | 'observacoes' | 'historico'

const MOV_TIPOS: { key: MovimentoTipo; label: string }[] = [
  { key: 'Entrada', label: 'Entrada' },
  { key: 'Saida', label: 'Saída' },
  { key: 'Ajuste', label: 'Ajuste (diferença)' },
  { key: 'Transferencia', label: 'Transferência' }
]

const MOV_MOTIVOS: string[] = ['Ajuste por Inventário', 'Compra', 'Venda', 'Consumo', 'Outros']

const formatDateBR = (isoDate: string) => {
  const raw = String(isoDate || '').slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

const Estoque: React.FC = () => {
  const { isAdmin } = useAuth()
  const location = useLocation()
  const isConsultaEstoque = location.pathname.includes('/compras-estoque/consultar-estoque')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CRM_Produto[]>([])
  const [familiasById, setFamiliasById] = useState<Record<string, string>>({})
  const [familiaOptions, setFamiliaOptions] = useState<{ familia_id: string; nome: string }[]>([])
  const [locais, setLocais] = useState<LocalEstoque[]>([])
  const locaisAtivos = useMemo(() => locais.filter((l) => l.ativo), [locais])

  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<'TODOS' | string>('TODOS')
  const [isLocalOpen, setIsLocalOpen] = useState(false)
  const localPickerRef = useRef<HTMLDivElement | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [draftSituacao, setDraftSituacao] = useState(true)
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftModelo, setDraftModelo] = useState('')
  const [draftMarca, setDraftMarca] = useState('')
  const [draftPreco, setDraftPreco] = useState('')
  const [draftUnidade, setDraftUnidade] = useState('UN')
  const [draftNcmCodigo, setDraftNcmCodigo] = useState('')
  const [draftFinalidadeItem, setDraftFinalidadeItem] = useState<'Revenda' | 'Consumo Interno' | 'Venda'>('Revenda')
  const [draftFamiliaId, setDraftFamiliaId] = useState('')
  const [draftFamiliaNova, setDraftFamiliaNova] = useState('')
  const [draftDescricaoDetalhada, setDraftDescricaoDetalhada] = useState('')
  const [draftObsProd, setDraftObsProd] = useState('')
  const [familiaSaving, setFamiliaSaving] = useState(false)

  const [ncmSearch, setNcmSearch] = useState('')
  const [ncmOptions, setNcmOptions] = useState<{ codigo: string; descricao: string }[]>([])
  const [ncmLoading, setNcmLoading] = useState(false)
  const [isNcmOpen, setIsNcmOpen] = useState(false)
  const ncmPickerRef = useRef<HTMLDivElement | null>(null)
  const [savedProduto, setSavedProduto] = useState<CRM_Produto | null>(null)
  const [produtoInfoTab, setProdutoInfoTab] = useState<ProdutoInfoTab>('detalhada')

  const [movimentosByProdutoId, setMovimentosByProdutoId] = useState<Record<string, MovimentoEstoque[]>>({})
  const [saldosByProdutoId, setSaldosByProdutoId] = useState<Record<string, Record<string, number>>>({})
  const [isMovimentoOpen, setIsMovimentoOpen] = useState(false)
  const [movimentoError, setMovimentoError] = useState<string | null>(null)
  const [movimentoSaving, setMovimentoSaving] = useState(false)
  const [movTipo, setMovTipo] = useState<'Entrada' | 'Saida' | 'Ajuste' | 'Transferencia'>('Entrada')
  const [movData, setMovData] = useState(new Date().toISOString().slice(0, 10))
  const [movLocalOrigem, setMovLocalOrigem] = useState('')
  const [movLocalDestino, setMovLocalDestino] = useState('')
  const [movQuantidade, setMovQuantidade] = useState('')
  const [movMotivo, setMovMotivo] = useState(MOV_MOTIVOS[0] || 'Ajuste por Inventário')

  const getSaldoLocal = (prodId: string, local: string) => {
    return Number(saldosByProdutoId[prodId]?.[local] ?? 0)
  }

  const openMovimentoModal = (p: CRM_Produto) => {
    setMovimentoError(null)
    setMovTipo('Entrada')
    setMovData(new Date().toISOString().slice(0, 10))
    const defaultLocal = localFilter === 'TODOS' ? (locaisAtivos[0]?.nome || '') : localFilter
    setMovLocalOrigem(defaultLocal)
    setMovLocalDestino(locaisAtivos.find((l) => l.nome !== defaultLocal)?.nome || '')
    setMovQuantidade('')
    setMovMotivo(MOV_MOTIVOS[0] || 'Ajuste por Inventário')
    setIsMovimentoOpen(true)
  }

  const handleSalvarMovimento = async () => {
    if (!savedProduto) return
    setMovimentoError(null)

    const localOrigem = String(movLocalOrigem || '').trim()
    if (!localOrigem) {
      setMovimentoError('Selecione o local de estoque.')
      return
    }
    const localDestino = String(movLocalDestino || '').trim()
    if (movTipo === 'Transferencia' && !localDestino) {
      setMovimentoError('Selecione o local de destino.')
      return
    }

    const quantidade = parseMoneyInput(movQuantidade) ?? Number(movQuantidade)
    if (!Number.isFinite(quantidade) || quantidade === 0) {
      setMovimentoError('A "Quantidade" do movimento de estoque é inválida.')
      return
    }
    if (movTipo !== 'Ajuste' && quantidade < 0) {
      setMovimentoError('A "Quantidade" deve ser maior que zero.')
      return
    }
    const data = String(movData || '').slice(0, 10)
    if (!data) {
      setMovimentoError('Informe a data do movimento.')
      return
    }
    const motivo = movMotivo.trim()
    if (!motivo) {
      setMovimentoError('Informe o motivo do movimento.')
      return
    }

    if (movTipo === 'Transferencia' && localOrigem === localDestino) {
      setMovimentoError('Para transferência, escolha locais diferentes.')
      return
    }

    setMovimentoSaving(true)
    try {
      await api.estoque.movimentar({
        prod_id: savedProduto.prod_id,
        tipo_movimentacao: movTipo,
        quantidade,
        local_estoque: localOrigem,
        local_estoque_destino: movTipo === 'Transferencia' ? localDestino : null,
        motivo,
        data_movimentacao: data
      })

      await loadMovimentos(savedProduto.prod_id)
      await loadSaldos([savedProduto.prod_id])
      setIsMovimentoOpen(false)
    } catch (e) {
      setMovimentoError(e instanceof Error ? e.message : 'Falha ao salvar movimento')
    } finally {
      setMovimentoSaving(false)
    }
  }

  const fillDraftFromProduto = (p: CRM_Produto) => {
    setDraftSituacao(!!p.situacao_prod)
    setDraftDescricao(p.descricao_prod || '')
    setDraftModelo(p.modelo_prod || '')
    setDraftMarca(p.marca_prod || '')
    setDraftPreco(p.produto_valor === null || p.produto_valor === undefined ? '' : String(p.produto_valor))
    setDraftUnidade(p.unidade_prod || 'UN')
    setDraftNcmCodigo(p.ncm_codigo || '')
    setDraftFinalidadeItem(p.finalidade_item === 'Consumo Interno' ? 'Consumo Interno' : p.finalidade_item === 'Venda' ? 'Venda' : 'Revenda')
    setDraftFamiliaId(p.familia_id || '')
    setDraftFamiliaNova('')
    setDraftDescricaoDetalhada(p.descricao_detalhada || '')
    setDraftObsProd(p.obs_prod || '')
    setNcmSearch('')
    setNcmOptions([])
    setIsNcmOpen(false)
  }

  const openProdutoModal = (p: CRM_Produto) => {
    setCreateError(null)
    setSavedProduto(p)
    setProdutoInfoTab('detalhada')
    setEditing(false)
    setIsCreateOpen(true)
    void loadMovimentos(p.prod_id)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        await loadLocais()
        const produtos = await fetchCrmProdutos()
        if (!cancelled) {
          setItems(produtos)
          const ids = produtos.map((p) => p.prod_id).filter(Boolean)
          await loadSaldos(ids)
        }
      } catch (e) {
        if (!cancelled) setError(formatUnknownError(e) || 'Falha ao carregar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const reloadProdutos = async () => {
    const produtos = await fetchCrmProdutos()
    setItems(produtos)
    await loadSaldos(produtos.map((p) => p.prod_id).filter(Boolean))
  }

  const loadLocais = async () => {
    try {
      const { data, error: qError } = await (supabase as any)
        .from('crm_locais_estoque')
        .select('local_id,nome,ativo')
        .order('nome', { ascending: true })
      if (qError) throw qError
      setLocais((data || []) as LocalEstoque[])
    } catch {
      setLocais([])
    }
  }

  const loadSaldos = async (prodIds: string[]) => {
    const ids = (prodIds || []).filter(Boolean)
    if (ids.length === 0) return
    try {
      const { data, error: qError } = await (supabase as any)
        .from('vw_saldo_produto')
        .select('prod_id,local_estoque,saldo')
        .in('prod_id', ids)

      if (qError) throw qError

      setSaldosByProdutoId((prev) => {
        const next: Record<string, Record<string, number>> = { ...prev }
        for (const id of ids) next[id] = {}
        for (const row of (data || []) as any[]) {
          const pid = String(row?.prod_id || '')
          const loc = String(row?.local_estoque || '')
          const saldo = Number(row?.saldo ?? 0)
          if (!pid) continue
          if (!loc) continue
          if (!next[pid]) next[pid] = {}
          next[pid][loc] = saldo
        }
        return next
      })
    } catch (e) {
      setSaldosByProdutoId((prev) => {
        const next: Record<string, Record<string, number>> = { ...prev }
        for (const id of ids) next[id] = {}
        return next
      })
      setError((prev) => prev || `Saldo indisponível: ${formatUnknownError(e)}`)
    }
  }

  const loadMovimentos = async (prodId: string) => {
    if (!prodId) return
    try {
      const { data, error: qError } = await (supabase as any)
        .from('crm_movimentacoes_estoque')
        .select('mov_id,prod_id,tipo_movimentacao,data_movimentacao,quantidade,local_estoque,motivo,user_id')
        .eq('prod_id', prodId)
        .order('data_movimentacao', { ascending: false })
        .limit(200)

      if (qError) throw qError

      setMovimentosByProdutoId((prev) => ({ ...prev, [prodId]: (data || []) as any }))
    } catch (e) {
      setMovimentosByProdutoId((prev) => ({ ...prev, [prodId]: [] }))
      setError((prev) => prev || `Histórico indisponível: ${formatUnknownError(e)}`)
    }
  }

  useEffect(() => {
    if (!isLocalOpen) return
    const onDown = (ev: MouseEvent) => {
      const el = localPickerRef.current
      if (!el) return
      if (!el.contains(ev.target as Node)) setIsLocalOpen(false)
    }
    window.addEventListener('mousedown', onDown, true)
    return () => window.removeEventListener('mousedown', onDown, true)
  }, [isLocalOpen])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const { data, error: qError } = await (supabase as any)
          .from('crm_produtos_familias')
          .select('familia_id,nome')
          .order('nome', { ascending: true })
        if (qError) throw qError
        const map: Record<string, string> = {}
        const opts: { familia_id: string; nome: string }[] = []
        for (const row of (data || []) as any[]) {
          if (row?.familia_id) {
            map[row.familia_id] = row.nome
            opts.push({ familia_id: row.familia_id, nome: row.nome })
          }
        }
        if (!cancelled) {
          setFamiliasById(map)
          setFamiliaOptions(opts)
        }
      } catch {
        if (!cancelled) {
          setFamiliasById({})
          setFamiliaOptions([])
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isCreateOpen) return
    setCreateError(null)
    setIsNcmOpen(false)
    setNcmSearch('')
    setNcmOptions([])
    if (savedProduto) return
    setEditing(false)
    setDraftSituacao(true)
    setDraftDescricao('')
    setDraftModelo('')
    setDraftMarca('')
    setDraftPreco('')
    setDraftUnidade('UN')
    setDraftNcmCodigo('')
    setDraftFinalidadeItem('Revenda')
    setDraftFamiliaId('')
    setDraftFamiliaNova('')
    setDraftDescricaoDetalhada('')
    setDraftObsProd('')
  }, [isCreateOpen, localFilter, savedProduto])

  useEffect(() => {
    if (!isCreateOpen || !isNcmOpen) return
    const term = ncmSearch.trim()

    const handle = setTimeout(async () => {
      setNcmLoading(true)
      try {
        const query = supabase.from('ncm').select('codigo,descricao').order('codigo', { ascending: true }).limit(50)
        const { data, error: qError } =
          term.length === 0
            ? await query
            : await query.or(`codigo.ilike.%${term}%,descricao.ilike.%${term}%`)

        if (qError) throw qError
        setNcmOptions(((data || []) as any[]).map((row) => ({ codigo: row.codigo, descricao: row.descricao })))
      } catch {
        setNcmOptions([])
      } finally {
        setNcmLoading(false)
      }
    }, 200)

    return () => clearTimeout(handle)
  }, [isCreateOpen, isNcmOpen, ncmSearch])

  useEffect(() => {
    if (!isNcmOpen) return
    const onDown = (ev: MouseEvent) => {
      const el = ncmPickerRef.current
      if (!el) return
      if (!el.contains(ev.target as Node)) setIsNcmOpen(false)
    }
    window.addEventListener('mousedown', onDown, true)
    return () => window.removeEventListener('mousedown', onDown, true)
  }, [isNcmOpen])

  const handleCreateFamilia = async () => {
    const nome = draftFamiliaNova.trim()
    if (!nome) {
      setCreateError('Informe o nome da família.')
      return
    }

    setFamiliaSaving(true)
    setCreateError(null)
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
      setFamiliasById((prev) => ({ ...prev, [data.familia_id]: data.nome }))
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
      setCreateError(e instanceof Error ? e.message : 'Falha ao criar família')
    } finally {
      setFamiliaSaving(false)
    }
  }

  const normalizeNcmCodigoInput = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '')
    if (digits.length !== 8) return null
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  }

  const handleSaveProduto = async () => {
    const descricao = draftDescricao.trim()
    if (!descricao) {
      setCreateError('A descrição é obrigatória.')
      return
    }
    const modelo = draftModelo.trim()
    if (!modelo) {
      setCreateError('O modelo é obrigatório.')
      return
    }
    const marca = draftMarca.trim()
    if (!marca) {
      setCreateError('A marca é obrigatória.')
      return
    }
    const unidade = draftUnidade.trim()
    if (!unidade) {
      setCreateError('A unidade é obrigatória.')
      return
    }
    const maskedNcm = normalizeNcmCodigoInput(draftNcmCodigo)
    if (!maskedNcm) {
      setCreateError('O NCM deve ter 8 dígitos.')
      return
    }
    const finalidade = draftFinalidadeItem
    if (!finalidade) {
      setCreateError('A finalidade do item é obrigatória.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      const valor = parseMoneyInput(draftPreco) ?? 0
      const descricaoDetalhada = draftDescricaoDetalhada.trim() || null
      const obs = draftObsProd.trim() || null
      if (savedProduto && editing) {
        const updated = await updateCrmProduto(savedProduto.prod_id, {
          situacao_prod: draftSituacao,
          marca_prod: marca,
          modelo_prod: modelo,
          descricao_prod: descricao,
          descricao_detalhada: descricaoDetalhada,
          finalidade_item: finalidade,
          cod_proposta_ref: null,
          unidade_prod: unidade,
          ncm_codigo: maskedNcm,
          familia_id: draftFamiliaId || null,
          obs_prod: obs,
          produto_valor: valor
        })
        setSavedProduto(updated)
        setEditing(false)
      } else {
        const created = await createCrmProduto({
          integ_id: null,
          situacao_prod: draftSituacao,
          marca_prod: marca,
          modelo_prod: modelo,
          descricao_prod: descricao,
          descricao_detalhada: descricaoDetalhada,
          finalidade_item: finalidade,
          cod_proposta_ref: null,
          unidade_prod: unidade,
          ncm_codigo: maskedNcm,
          familia_id: draftFamiliaId || null,
          obs_prod: obs,
          produto_valor: valor
        })
        setSavedProduto(created)
      }
      await reloadProdutos()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setCreating(false)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items
      .filter((p) => {
        if (!term) return true
        const desc = String(p.descricao_prod || '').toLowerCase()
        const cod = String(p.codigo_prod || '').toLowerCase()
        return desc.includes(term) || cod.includes(term)
      })
      .filter((p) => {
        if (localFilter === 'TODOS') return true
        return getSaldoLocal(p.prod_id, localFilter) !== 0
      })
  }, [items, search, localFilter, saldosByProdutoId])

  const filteredSorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      String(a.descricao_prod).localeCompare(String(b.descricao_prod), 'pt-BR', { sensitivity: 'base' })
    )
  }, [filtered])

  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
          <Box size={14} />
          Estoque
        </div>

        <button
          type="button"
          onClick={() => {
            setSavedProduto(null)
            setEditing(false)
            setCreateError(null)
            setDraftSituacao(true)
            setDraftDescricao('')
            setDraftModelo('')
            setDraftMarca('')
            setDraftPreco('')
            setDraftUnidade('UN')
            setDraftNcmCodigo('')
            setDraftFinalidadeItem('Revenda')
            setDraftFamiliaId('')
            setDraftFamiliaNova('')
            setDraftDescricaoDetalhada('')
            setDraftObsProd('')
            setNcmSearch('')
            setNcmOptions([])
            setIsNcmOpen(false)
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/15 transition-all active:scale-95"
        >
          <Plus size={16} />
          NOVO PRODUTO
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
            />
          </div>

          <div className="relative md:w-[360px]" ref={localPickerRef}>
            <button
              type="button"
              onClick={() => setIsLocalOpen((v) => !v)}
              className="w-full inline-flex items-center justify-between gap-2 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all hover:bg-white/5"
            >
              <span className="truncate">
                {localFilter === 'TODOS' ? 'Todos os locais' : localFilter}
              </span>
              <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isLocalOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLocalOpen && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0B1220] shadow-xl">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLocalFilter('TODOS')
                      setIsLocalOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      localFilter === 'TODOS'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    Todos os locais
                  </button>
                  {locaisAtivos.map((l) => (
                    <button
                      key={l.local_id}
                      type="button"
                      onClick={() => {
                        setLocalFilter(l.nome)
                        setIsLocalOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        localFilter === l.nome
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {l.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <div className="px-4 py-3 bg-white/5 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-widest text-[var(--text-soft)]">Produtos</div>
              <div className="text-xs text-[var(--text-muted)]">{filteredSorted.length} itens</div>
            </div>

            {filteredSorted.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">Nenhum produto encontrado.</div>
            ) : (
              <div className="overflow-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-[var(--border)]">
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Código</div>
                    <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Descrição</div>
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Saldo</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Unid.</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Família</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Preço</div>
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Ações</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {filteredSorted.map((p) => {
                      const saldos = saldosByProdutoId[p.prod_id] || {}
                      const total = Object.values(saldos).reduce((acc, v) => acc + Number(v || 0), 0)
                      const qtdLocais = Object.keys(saldos).length
                      const saldoSelecionado = localFilter === 'TODOS' ? null : getSaldoLocal(p.prod_id, localFilter)
                      return (
                        <div
                          key={p.prod_id}
                          onClick={() => openProdutoModal(p)}
                          className="grid grid-cols-12 gap-3 px-4 py-3 text-left w-full hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <div className="col-span-2 min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)] truncate" title={p.codigo_prod || ''}>
                              {p.codigo_prod || '-'}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">#{p.prod_id.split('-')[0]}</div>
                          </div>
                          <div className="col-span-3 min-w-0">
                            <div className="text-sm text-[var(--text)] truncate" title={p.descricao_prod}>
                              {p.descricao_prod}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{p.ncm_codigo || '-'}</div>
                          </div>
                          <div className="col-span-2 min-w-0">
                            {localFilter === 'TODOS' ? (
                              <>
                                <div className="text-sm text-[var(--text)] font-mono truncate">
                                  Total: {total.toLocaleString('pt-BR')}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                                  Locais: {qtdLocais}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm text-[var(--text)] font-mono truncate">
                                  {saldoSelecionado?.toLocaleString('pt-BR') ?? '0'}
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate" title={localFilter}>
                                  {localFilter}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="col-span-1 min-w-0">
                            <div className="text-sm text-[var(--text)] font-mono truncate">{p.unidade_prod || '-'}</div>
                          </div>
                          <div className="col-span-1 min-w-0">
                            <div className="text-sm text-[var(--text)] truncate">
                              {p.familia_id ? familiasById[p.familia_id] || '-' : '-'}
                            </div>
                          </div>
                          <div className="col-span-1 min-w-0 text-right">
                            <div className="text-sm text-[var(--text)] truncate">{formatCurrency(p.produto_valor)}</div>
                          </div>
                          <div className="col-span-2 min-w-0 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMovimentoModal(p)
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            >
                              Nova Movimentação
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          if (creating || familiaSaving) return
          setSavedProduto(null)
          setEditing(false)
          setIsCreateOpen(false)
        }}
        size="full"
        className="max-w-6xl"
        title={
          savedProduto ? (
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Produtos</div>
              <div className="text-base font-bold text-[var(--text-main)] truncate">{savedProduto.descricao_prod}</div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Estoque</div>
              <div className="text-base font-bold text-[var(--text-main)] truncate">Novo Produto</div>
            </div>
          )
        }
        footer={
          savedProduto ? (
            editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCreateError(null)
                    setEditing(false)
                    setIsNcmOpen(false)
                    setNcmSearch('')
                    setNcmOptions([])
                  }}
                  disabled={creating || familiaSaving}
                  className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveProduto}
                  disabled={creating || familiaSaving || !draftDescricao.trim()}
                  className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSavedProduto(null)
                    setEditing(false)
                    setIsCreateOpen(false)
                  }}
                  disabled={creating || familiaSaving}
                  className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!savedProduto) return
                    openMovimentoModal(savedProduto)
                  }}
                  disabled={creating || familiaSaving}
                  className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                >
                  Novo Movimento
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setSavedProduto(null)
                  setEditing(false)
                  setIsCreateOpen(false)
                }}
                disabled={creating || familiaSaving}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduto}
                disabled={creating || familiaSaving || !draftDescricao.trim()}
                className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </>
          )
        }
      >
        {savedProduto && !editing ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300">Dados do Produto</div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!savedProduto) return
                      setCreateError(null)
                      fillDraftFromProduto(savedProduto)
                      setEditing(true)
                    }}
                    disabled={creating || familiaSaving}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    title="Editar"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Descrição</div>
                  <div className="text-sm font-semibold text-slate-100 break-words">{savedProduto.descricao_prod || '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Código</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">{savedProduto.codigo_prod || '-'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Marca</div>
                  <div className="text-sm font-semibold text-slate-100">{savedProduto.marca_prod || '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modelo</div>
                  <div className="text-sm font-semibold text-slate-100">{savedProduto.modelo_prod || '-'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finalidade</div>
                  <div className="text-sm font-semibold text-slate-100">{savedProduto.finalidade_item || '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Situação</div>
                  <div className="text-sm font-semibold text-slate-100">{savedProduto.situacao_prod ? 'Ativo' : 'Inativo'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unidade</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">{savedProduto.unidade_prod || '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Código NCM</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">{savedProduto.ncm_codigo || '-'}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Família</div>
                  <div className="text-sm font-semibold text-slate-100">
                    {savedProduto.familia_id ? familiasById[savedProduto.familia_id] || '-' : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preço Unitário</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">{formatCurrency(savedProduto.produto_valor)}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ref. Proposta</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">{savedProduto.cod_proposta_ref || '-'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Atualizado em</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">
                    {savedProduto.atualizado_em ? formatDateBR(savedProduto.atualizado_em) : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-white/10 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-1 min-w-max">
                {(
                  [
                    { key: 'detalhada', label: 'Descrição Detalhada' },
                    { key: 'local', label: 'Local do Estoque' },
                    { key: 'observacoes', label: 'Observações' },
                    { key: 'historico', label: 'Histórico' }
                  ] as Array<{ key: ProdutoInfoTab; label: string }>
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setProdutoInfoTab(t.key)}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors whitespace-nowrap ${
                      produtoInfoTab === t.key ? 'text-emerald-200 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
              {produtoInfoTab === 'detalhada' && (
                <div className="text-sm text-slate-100 whitespace-pre-wrap break-words">
                  {savedProduto.descricao_detalhada?.trim() ? savedProduto.descricao_detalhada : '-'}
                </div>
              )}

              {produtoInfoTab === 'observacoes' && (
                <div className="text-sm text-slate-100 whitespace-pre-wrap break-words">
                  {savedProduto.obs_prod?.trim() ? savedProduto.obs_prod : '-'}
                </div>
              )}

              {produtoInfoTab === 'local' && (
                <div className="overflow-auto">
                  <div className="min-w-[520px]">
                    <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10 rounded-xl">
                      <div className="col-span-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Local</div>
                      <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Disponível</div>
                    </div>
                    {locaisAtivos.length === 0 ? (
                      <div className="px-4 py-4 text-xs text-slate-400">Nenhum local de estoque cadastrado.</div>
                    ) : (
                      locaisAtivos.map((l) => {
                        const qty = getSaldoLocal(savedProduto.prod_id, l.nome)
                        return (
                          <div key={l.local_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                            <div className="col-span-8 text-sm text-slate-100 truncate" title={l.nome}>
                              {l.nome}
                            </div>
                            <div className="col-span-4 text-sm font-mono text-slate-100 text-right">{qty.toLocaleString('pt-BR')}</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {produtoInfoTab === 'historico' && (
                <div className="overflow-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10 rounded-xl">
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</div>
                      <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</div>
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Local</div>
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</div>
                      <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo</div>
                    </div>
                    {(movimentosByProdutoId[savedProduto.prod_id] || []).length === 0 ? (
                      <div className="px-4 py-4 text-xs text-slate-400">Nenhum movimento registrado.</div>
                    ) : (
                      (movimentosByProdutoId[savedProduto.prod_id] || []).map((m) => (
                        <div key={m.mov_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                          <div className="col-span-2 text-sm text-slate-100 font-mono">{formatDateBR(m.data_movimentacao)}</div>
                          <div className="col-span-3 text-sm text-slate-100">{m.tipo_movimentacao}</div>
                          <div className="col-span-2 text-sm text-slate-100">{m.local_estoque}</div>
                          <div className="col-span-2 text-sm text-slate-100 font-mono">{m.quantidade.toLocaleString('pt-BR')}</div>
                          <div className="col-span-3 text-sm text-slate-100 truncate" title={m.motivo || ''}>
                            {m.motivo || '-'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {createError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-9 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição do Produto</label>
                  <input
                    value={draftDescricao}
                    onChange={(e) => setDraftDescricao(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                    placeholder="Ex: Produto A"
                    autoFocus
                  />
                </div>

                {savedProduto ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código do Produto</label>
                    <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 font-mono">
                      {savedProduto.codigo_prod || '-'}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Marca</label>
                    <input
                      value={draftMarca}
                      onChange={(e) => setDraftMarca(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                      placeholder="Ex: DJI"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Modelo</label>
                    <input
                      value={draftModelo}
                      onChange={(e) => setDraftModelo(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                      placeholder="Ex: Mavic 3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Finalidade do Item</label>
                    <select
                      value={draftFinalidadeItem}
                      onChange={(e) => {
                        const v = e.target.value as 'Revenda' | 'Consumo Interno' | 'Venda'
                        setDraftFinalidadeItem(v)
                      }}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      <option value="Revenda">Revenda</option>
                      <option value="Consumo Interno">Consumo Interno</option>
                      <option value="Venda">Venda</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Situação</label>
                    <select
                      value={draftSituacao ? 'ATIVO' : 'INATIVO'}
                      onChange={(e) => setDraftSituacao(e.target.value === 'ATIVO')}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Unidade</label>
                    <select
                      value={draftUnidade}
                      onChange={(e) => setDraftUnidade(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      <option value="UN">UN</option>
                      <option value="PC">Peça (PC)</option>
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
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Preço Unitário de Venda</label>
                    <input
                      value={draftPreco}
                      onChange={(e) => setDraftPreco(e.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono text-right"
                      placeholder="Ex: 199,90"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código NCM</label>
                    <div className="relative" ref={ncmPickerRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNcmOpen((v) => !v)
                          if (!isNcmOpen) setNcmSearch('')
                        }}
                        className="w-full inline-flex items-center justify-between gap-3 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all hover:bg-white/5"
                      >
                        <span className={`truncate font-mono ${draftNcmCodigo ? 'text-slate-100' : 'text-slate-500 font-sans'}`}>
                          {draftNcmCodigo || 'Selecionar NCM'}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-2">
                          {ncmLoading ? (
                            <Loader2 className="animate-spin text-slate-500" size={16} />
                          ) : (
                            <Search size={16} className="text-slate-400" />
                          )}
                          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isNcmOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {isNcmOpen && (
                        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0B1220] shadow-xl">
                          <div className="p-3 border-b border-white/10">
                            <div className="relative">
                              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                value={ncmSearch}
                                onChange={(e) => setNcmSearch(e.target.value)}
                                placeholder="Buscar por código ou descrição..."
                                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                              />
                            </div>
                          </div>

                          <div className="max-h-64 overflow-auto custom-scrollbar">
                            {ncmOptions.length === 0 ? (
                              <div className="px-4 py-4 text-xs text-slate-400">
                                {ncmLoading ? 'Carregando...' : 'Nenhum NCM encontrado.'}
                              </div>
                            ) : (
                              ncmOptions.map((opt) => (
                                <button
                                  type="button"
                                  key={opt.codigo}
                                  onClick={() => {
                                    setDraftNcmCodigo(opt.codigo)
                                    setIsNcmOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                                >
                                  <div className="text-sm font-mono text-slate-200">{opt.codigo}</div>
                                  <div className="text-xs text-slate-400">{opt.descricao}</div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Família de Produto</label>
                    <select
                      value={draftFamiliaId}
                      onChange={(e) => setDraftFamiliaId(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      <option value="">Selecione (opcional)</option>
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
                        className="flex-1 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                        placeholder="Criar nova família..."
                      />
                      <button
                        type="button"
                        onClick={handleCreateFamilia}
                        disabled={familiaSaving || !draftFamiliaNova.trim()}
                        className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center justify-center gap-2"
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição detalhada</label>
                    <textarea
                      value={draftDescricaoDetalhada}
                      onChange={(e) => setDraftDescricaoDetalhada(e.target.value)}
                      className="w-full min-h-[140px] rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                      placeholder=""
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações</label>
                    <textarea
                      value={draftObsProd}
                      onChange={(e) => setDraftObsProd(e.target.value)}
                      className="w-full min-h-[140px] rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3" />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isMovimentoOpen}
        onClose={() => {
          if (movimentoSaving) return
          setIsMovimentoOpen(false)
        }}
        size="xl"
        className="max-w-4xl"
        zIndex={120}
        title={
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Novo Movimento de Estoque</div>
            <div className="text-base font-bold text-[var(--text-main)] truncate">{savedProduto?.descricao_prod || '-'}</div>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                if (movimentoSaving) return
                setIsMovimentoOpen(false)
              }}
              disabled={movimentoSaving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-60 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarMovimento}
              disabled={movimentoSaving}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
            >
              {movimentoSaving ? 'Salvando...' : 'Salvar Movimento'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {movimentoError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {movimentoError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Tipo do Movimento de Estoque</label>
              <select
                value={movTipo}
                onChange={(e) => setMovTipo(e.target.value as any)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              >
                {MOV_TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Data</label>
              <input
                type="date"
                value={movData}
                onChange={(e) => setMovData(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">
                Quantidade ({savedProduto?.unidade_prod || 'UN'})
              </label>
              <input
                value={movQuantidade}
                onChange={(e) => setMovQuantidade(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono text-right"
                placeholder="0,000000"
              />
            </div>
            {movTipo === 'Transferencia' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local de Origem</label>
                  <select
                    value={movLocalOrigem}
                    onChange={(e) => setMovLocalOrigem(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                  >
                    {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                    {locaisAtivos.map((l) => (
                      <option key={l.local_id} value={l.nome}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local de Destino</label>
                  <select
                    value={movLocalDestino}
                    onChange={(e) => setMovLocalDestino(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                  >
                    {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                    {locaisAtivos.map((l) => (
                      <option key={l.local_id} value={l.nome}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local de Estoque</label>
                <select
                  value={movLocalOrigem}
                  onChange={(e) => setMovLocalOrigem(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                >
                  {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                  {locaisAtivos.map((l) => (
                    <option key={l.local_id} value={l.nome}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Motivo do Movimento de Estoque</label>
              <select
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              >
                {MOV_MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Estoque
