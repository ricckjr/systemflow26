import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, ChevronDown, Image as ImageIcon, Loader2, Plus, Search } from 'lucide-react'
import { createCrmProduto, fetchCrmProdutos, updateCrmProduto, type CRM_Produto } from '@/services/crm'
import { supabase } from '@/services/supabase'
import { Modal } from '@/components/ui'

type LocalCode = '03' | '04'

const LOCAIS: { code: LocalCode; label: string }[] = [
  { code: '03', label: 'Estoque de Produto (Revenda)' },
  { code: '04', label: 'Estoque de Consumo' }
]

const normalizeLocal = (v: CRM_Produto['local_estoque']): LocalCode => {
  if (v === '04' || v === 'INTERNO') return '04'
  return '03'
}

const formatCurrency = (value: number | null) => {
  const num = Number(value ?? 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const localLabel = (code: LocalCode) => LOCAIS.find((l) => l.code === code)?.label ?? code

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

type ProdutoTab =
  | 'estoque'
  | 'custo_estoque'
  | 'fornecedores'
  | 'historicos'
  | 'info_adicionais'
  | 'caracteristicas'
  | 'recomendacoes_fiscais'
  | 'observadores'

type MovimentoTipo = 'ENTRADA' | 'SAIDA'

type MovimentoEstoque = {
  movimento_id: string
  prod_id: string
  tipo: MovimentoTipo
  data: string
  local: LocalCode
  quantidade: number
  valor_unitario: number
  motivo: string
  observacao: string
}

type PropostaReferente = {
  id_oport: string
  cod_oport: string | null
  descricao_oport: string | null
  cliente: string | null
}

const PRODUTO_TABS: { key: ProdutoTab; label: string }[] = [
  { key: 'estoque', label: 'Estoque' },
  { key: 'custo_estoque', label: 'Custo do Estoque' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'historicos', label: 'Históricos' },
  { key: 'info_adicionais', label: 'Informações Adicionais' },
  { key: 'caracteristicas', label: 'Características' },
  { key: 'recomendacoes_fiscais', label: 'Recomendações fiscais' },
  { key: 'observadores', label: 'Observadores' }
]

const MOV_TIPOS: { key: MovimentoTipo; label: string }[] = [
  { key: 'ENTRADA', label: 'Criar um movimento de entrada' },
  { key: 'SAIDA', label: 'Criar um movimento de saída' }
]

const MOV_MOTIVOS: string[] = ['Ajuste por Inventário', 'Compra', 'Venda', 'Consumo', 'Outros']

const formatDateBR = (isoDate: string) => {
  const raw = String(isoDate || '').slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

const randomId = () => {
  const anyCrypto = globalThis as any
  if (anyCrypto?.crypto?.randomUUID) return anyCrypto.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const Estoque: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CRM_Produto[]>([])
  const [familiasById, setFamiliasById] = useState<Record<string, string>>({})
  const [familiaOptions, setFamiliaOptions] = useState<{ familia_id: string; nome: string }[]>([])

  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<'TODOS' | LocalCode>('TODOS')
  const [isLocalOpen, setIsLocalOpen] = useState(false)
  const localPickerRef = useRef<HTMLDivElement | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [draftSituacao, setDraftSituacao] = useState(true)
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftGtinEan, setDraftGtinEan] = useState('')
  const [draftCodPropostaRef, setDraftCodPropostaRef] = useState('')
  const [draftPreco, setDraftPreco] = useState('')
  const [draftUnidade, setDraftUnidade] = useState('UN')
  const [draftNcmCodigo, setDraftNcmCodigo] = useState('')
  const [draftLocalEstoque, setDraftLocalEstoque] = useState<LocalCode>('03')
  const [draftFamiliaId, setDraftFamiliaId] = useState('')
  const [draftFamiliaNova, setDraftFamiliaNova] = useState('')
  const [familiaSaving, setFamiliaSaving] = useState(false)

  const [ncmSearch, setNcmSearch] = useState('')
  const [ncmOptions, setNcmOptions] = useState<{ codigo: string; descricao: string }[]>([])
  const [ncmLoading, setNcmLoading] = useState(false)
  const [isNcmOpen, setIsNcmOpen] = useState(false)
  const ncmPickerRef = useRef<HTMLDivElement | null>(null)
  const [savedProduto, setSavedProduto] = useState<CRM_Produto | null>(null)
  const [produtoTab, setProdutoTab] = useState<ProdutoTab>('estoque')

  const [imagemUploading, setImagemUploading] = useState(false)
  const imagemInputRef = useRef<HTMLInputElement | null>(null)

  const [movimentosByProdutoId, setMovimentosByProdutoId] = useState<Record<string, MovimentoEstoque[]>>({})
  const [isMovimentoOpen, setIsMovimentoOpen] = useState(false)
  const [movimentoError, setMovimentoError] = useState<string | null>(null)
  const [movTipo, setMovTipo] = useState<MovimentoTipo>('ENTRADA')
  const [movData, setMovData] = useState(new Date().toISOString().slice(0, 10))
  const [movLocal, setMovLocal] = useState<LocalCode>('03')
  const [movQuantidade, setMovQuantidade] = useState('')
  const [movValorUnitario, setMovValorUnitario] = useState('')
  const [movMotivo, setMovMotivo] = useState(MOV_MOTIVOS[0] || 'Ajuste por Inventário')
  const [movObservacao, setMovObservacao] = useState('')

  const [propostasLoading, setPropostasLoading] = useState(false)
  const [propostasReferentes, setPropostasReferentes] = useState<PropostaReferente[]>([])

  const getSaldoLocal = (prodId: string, local: LocalCode) => {
    const list = movimentosByProdutoId[prodId] || []
    let qty = 0
    for (const m of list) {
      if (m.local !== local) continue
      qty += m.tipo === 'ENTRADA' ? m.quantidade : -m.quantidade
    }
    return qty
  }

  const openMovimentoModal = (p: CRM_Produto) => {
    setMovimentoError(null)
    setMovTipo('ENTRADA')
    setMovData(new Date().toISOString().slice(0, 10))
    setMovLocal(normalizeLocal(p.local_estoque))
    setMovQuantidade('')
    setMovValorUnitario(p.produto_valor === null || p.produto_valor === undefined ? '' : String(p.produto_valor))
    setMovMotivo(MOV_MOTIVOS[0] || 'Ajuste por Inventário')
    setMovObservacao('')
    setIsMovimentoOpen(true)
  }

  const handleSalvarMovimento = () => {
    if (!savedProduto) return
    setMovimentoError(null)
    const quantidade = parseMoneyInput(movQuantidade) ?? Number(movQuantidade)
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      setMovimentoError('A "Quantidade" do movimento de estoque deve ser maior que zero.')
      return
    }
    const valorUnit = parseMoneyInput(movValorUnitario) ?? Number(movValorUnitario)
    if (!Number.isFinite(valorUnit) || valorUnit < 0) {
      setMovimentoError('Informe um valor unitário válido.')
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

    const movimento: MovimentoEstoque = {
      movimento_id: randomId(),
      prod_id: savedProduto.prod_id,
      tipo: movTipo,
      data,
      local: movLocal,
      quantidade,
      valor_unitario: valorUnit,
      motivo,
      observacao: movObservacao.trim()
    }
    setMovimentosByProdutoId((prev) => {
      const list = prev[savedProduto.prod_id] || []
      const next = [...list, movimento].sort((a, b) => String(b.data).localeCompare(String(a.data)))
      return { ...prev, [savedProduto.prod_id]: next }
    })
    setIsMovimentoOpen(false)
    setProdutoTab('historicos')
  }

  useEffect(() => {
    const prodId = savedProduto?.prod_id
    if (!prodId) {
      setPropostasReferentes([])
      return
    }

    let cancelled = false
    const run = async () => {
      setPropostasLoading(true)
      try {
        const baseCols = 'id_oport,cod_oport,descricao_oport,cliente'
        const direct = await (supabase as any)
          .from('crm_oportunidades')
          .select(baseCols)
          .eq('cod_produto', prodId)
          .order('data_inclusao', { ascending: false })

        const directList: PropostaReferente[] = (direct?.data || []) as any[]

        const itens = await (supabase as any)
          .from('crm_oportunidade_itens')
          .select('id_oport')
          .eq('tipo', 'PRODUTO')
          .eq('produto_id', prodId)

        const ids = Array.from(new Set(((itens?.data || []) as any[]).map((r) => r?.id_oport).filter(Boolean)))
        const directIds = new Set((directList || []).map((r) => r.id_oport))
        const missingIds = ids.filter((id) => !directIds.has(id))

        let fromItens: PropostaReferente[] = []
        if (missingIds.length > 0) {
          const opps = await (supabase as any).from('crm_oportunidades').select(baseCols).in('id_oport', missingIds)
          fromItens = (opps?.data || []) as any[]
        }

        const merged = [...directList, ...fromItens].reduce<PropostaReferente[]>((acc, cur) => {
          if (!cur?.id_oport) return acc
          if (acc.some((x) => x.id_oport === cur.id_oport)) return acc
          acc.push({
            id_oport: cur.id_oport,
            cod_oport: cur.cod_oport ?? null,
            descricao_oport: cur.descricao_oport ?? null,
            cliente: cur.cliente ?? null
          })
          return acc
        }, [])

        if (!cancelled) setPropostasReferentes(merged)
      } catch {
        if (!cancelled) setPropostasReferentes([])
      } finally {
        if (!cancelled) setPropostasLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [savedProduto?.prod_id])

  const getProdutoImagemUrl = (p: CRM_Produto | null) => {
    const path = p?.imagem_path
    if (!path) return null
    return supabase.storage.from('produtos').getPublicUrl(path).data.publicUrl
  }

  const handlePickImagem = () => {
    if (!savedProduto) return
    imagemInputRef.current?.click()
  }

  const handleUploadImagem = async (file: File) => {
    if (!savedProduto) return
    setCreateError(null)
    setImagemUploading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Sessão expirada. Faça login novamente.')

      const parts = String(file.name || '').split('.')
      const ext = (parts.length > 1 ? parts[parts.length - 1] : 'png').toLowerCase()
      const safeExt = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' ? ext : 'png'
      const path = `produtos/${userId}/${savedProduto.prod_id}-${Date.now()}.${safeExt}`

      const { error: upError } = await supabase.storage.from('produtos').upload(path, file, { upsert: true })
      if (upError) throw upError

      const updated = await updateCrmProduto(savedProduto.prod_id, { imagem_path: path })
      setSavedProduto(updated)
      try {
        await (supabase as any).from('crm_produtos_imagens').insert({ prod_id: savedProduto.prod_id, storage_path: path })
      } catch {}
      await reloadProdutos()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Falha ao enviar imagem')
    } finally {
      setImagemUploading(false)
    }
  }

  const fillDraftFromProduto = (p: CRM_Produto) => {
    setDraftSituacao(!!p.situacao_prod)
    setDraftDescricao(p.descricao_prod || '')
    setDraftGtinEan(p.gtin_ean || '')
    setDraftCodPropostaRef(p.cod_proposta_ref || '')
    setDraftPreco(p.produto_valor === null || p.produto_valor === undefined ? '' : String(p.produto_valor))
    setDraftUnidade(p.unidade_prod || 'UN')
    setDraftNcmCodigo(p.ncm_codigo || '')
    setDraftLocalEstoque(normalizeLocal(p.local_estoque))
    setDraftFamiliaId(p.familia_id || '')
    setDraftFamiliaNova('')
    setNcmSearch('')
    setNcmOptions([])
    setIsNcmOpen(false)
  }

  const openProdutoModal = (p: CRM_Produto) => {
    setCreateError(null)
    setSavedProduto(p)
    setProdutoTab('estoque')
    setEditing(false)
    setIsCreateOpen(true)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const produtos = await fetchCrmProdutos()
        if (!cancelled) setItems(produtos)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar')
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
    setProdutoTab('estoque')
    setDraftSituacao(true)
    setDraftDescricao('')
    setDraftGtinEan('')
    setDraftPreco('')
    setDraftUnidade('UN')
    setDraftNcmCodigo('')
    setDraftLocalEstoque(localFilter === 'TODOS' ? '03' : localFilter)
    setDraftFamiliaId('')
    setDraftFamiliaNova('')
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

    setCreating(true)
    setCreateError(null)
    try {
      const valor = parseMoneyInput(draftPreco) ?? 0
      const gtinDigits = draftGtinEan.replace(/\D/g, '')
      const gtinEan = gtinDigits ? gtinDigits : null
      const codPropostaRef = draftCodPropostaRef.trim() || null
      if (savedProduto && editing) {
        const updated = await updateCrmProduto(savedProduto.prod_id, {
          descricao_prod: descricao,
          gtin_ean: gtinEan,
          cod_proposta_ref: codPropostaRef,
          unidade_prod: unidade,
          ncm_codigo: maskedNcm,
          local_estoque: draftLocalEstoque,
          familia_id: draftFamiliaId || null,
          produto_valor: valor
        })
        setSavedProduto(updated)
        setEditing(false)
        setProdutoTab('estoque')
      } else {
        const created = await createCrmProduto({
          integ_id: null,
          situacao_prod: draftSituacao,
          marca_prod: null,
          modelo_prod: null,
          descricao_prod: descricao,
          gtin_ean: gtinEan,
          cod_proposta_ref: codPropostaRef,
          unidade_prod: unidade,
          ncm_codigo: maskedNcm,
          local_estoque: draftLocalEstoque,
          familia_id: draftFamiliaId || null,
          obs_prod: null,
          produto_valor: valor
        })
        setSavedProduto(created)
        setProdutoTab('estoque')
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
        return String(p.descricao_prod || '').toLowerCase().includes(term)
      })
      .filter((p) => {
        if (localFilter === 'TODOS') return true
        return normalizeLocal(p.local_estoque) === localFilter
      })
  }, [items, search, localFilter])

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
            setProdutoTab('estoque')
            setCreateError(null)
            setDraftSituacao(true)
            setDraftDescricao('')
            setDraftGtinEan('')
            setDraftCodPropostaRef('')
            setDraftPreco('')
            setDraftUnidade('UN')
            setDraftNcmCodigo('')
            setDraftLocalEstoque(localFilter === 'TODOS' ? '03' : localFilter)
            setDraftFamiliaId('')
            setDraftFamiliaNova('')
            setNcmSearch('')
            setNcmOptions([])
            setIsNcmOpen(false)
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 transition-all active:scale-95"
        >
          <Plus size={16} />
          Adicionar Produto
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por descrição do produto..."
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
                {localFilter === 'TODOS' ? 'Todos os locais' : localLabel(localFilter)}
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
                  {LOCAIS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLocalFilter(l.code)
                        setIsLocalOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        localFilter === l.code
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {l.label}
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
                    <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Descrição</div>
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Local</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Unid.</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Família</div>
                    <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Preço</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {filteredSorted.map((p) => {
                      const loc = normalizeLocal(p.local_estoque)
                      return (
                        <button
                          key={p.prod_id}
                          type="button"
                          onClick={() => openProdutoModal(p)}
                          className="grid grid-cols-12 gap-3 px-4 py-3 text-left w-full hover:bg-white/5 transition-colors"
                        >
                          <div className="col-span-2 min-w-0">
                            <div className="text-sm font-semibold text-[var(--text)] truncate" title={p.codigo_prod || ''}>
                              {p.codigo_prod || '-'}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">#{p.prod_id.split('-')[0]}</div>
                          </div>
                          <div className="col-span-5 min-w-0">
                            <div className="text-sm text-[var(--text)] truncate" title={p.descricao_prod}>
                              {p.descricao_prod}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{p.ncm_codigo || '-'}</div>
                          </div>
                          <div className="col-span-2 min-w-0">
                            <div className="text-sm text-[var(--text)] truncate" title={localLabel(loc)}>
                              {localLabel(loc)}
                            </div>
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
                        </button>
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
                <button
                  type="button"
                  onClick={() => {
                    if (!savedProduto) return
                    setCreateError(null)
                    fillDraftFromProduto(savedProduto)
                    setEditing(true)
                  }}
                  disabled={creating || familiaSaving}
                  className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                >
                  Editar
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
        <input
          ref={imagemInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            void handleUploadImagem(f)
          }}
        />

        {savedProduto && !editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0B1220] p-4">
                <div className="relative aspect-square rounded-xl border border-white/10 bg-black/20 overflow-hidden flex items-center justify-center">
                  {getProdutoImagemUrl(savedProduto) ? (
                    <img
                      src={getProdutoImagemUrl(savedProduto) as string}
                      alt={savedProduto.descricao_prod}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={26} className="text-slate-500" />
                  )}
                  {imagemUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-slate-200" size={22} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePickImagem}
                  disabled={!savedProduto || imagemUploading}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-white/5 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                >
                  Alterar
                </button>
                <div className="mt-2 text-center text-[11px] text-slate-500">
                  {savedProduto.imagem_path ? 'Imagem cadastrada' : 'Nenhuma imagem'}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição do Produto</label>
                  <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100">
                    {savedProduto.descricao_prod}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código do Produto</label>
                    <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 font-mono">
                      {savedProduto.codigo_prod || '-'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código EAN (GTIN)</label>
                    <div
                      className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium font-mono ${
                        savedProduto.gtin_ean ? 'text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      {savedProduto.gtin_ean || 'Opcional'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cod de Proposta referente</label>
                    <div
                      className={`w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium font-mono ${
                        savedProduto.cod_proposta_ref ? 'text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      {savedProduto.cod_proposta_ref || 'Opcional'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Unidade</label>
                    <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100">
                      {savedProduto.unidade_prod || '-'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Preço Unitário de Venda</label>
                    <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 font-mono text-right">
                      {formatCurrency(savedProduto.produto_valor)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código NCM</label>
                    <div className="relative">
                      <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 pr-10 text-sm font-medium text-slate-100 font-mono">
                        {savedProduto.ncm_codigo || '-'}
                      </div>
                      <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Família de Produto</label>
                    <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 truncate">
                      {savedProduto.familia_id ? familiasById[savedProduto.familia_id] || '-' : '-'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3" />
            </div>

            <div className="border-b border-white/10 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-1 min-w-max">
                {PRODUTO_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setProdutoTab(t.key)}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors whitespace-nowrap ${
                      produtoTab === t.key ? 'text-emerald-200 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
              {produtoTab === 'estoque' && (
                <div className="space-y-4">
                  <div className="overflow-auto">
                    <div className="min-w-[860px]">
                      <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10">
                        <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Local Estoque</div>
                        <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade disponível</div>
                        <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Unitário</div>
                        <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Total</div>
                        <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Estoque Mínimo</div>
                      </div>
                      {(() => {
                        const local = normalizeLocal(savedProduto.local_estoque)
                        const qty = getSaldoLocal(savedProduto.prod_id, local)
                        const unit = Number(savedProduto.produto_valor ?? 0)
                        const total = qty * unit
                        return (
                          <div className="grid grid-cols-12 gap-3 px-4 py-3">
                            <div className="col-span-3 text-sm text-slate-100 truncate" title={localLabel(local)}>
                              {localLabel(local)}
                            </div>
                            <div className="col-span-2 text-sm font-mono text-slate-100">{qty.toLocaleString('pt-BR')}</div>
                            <div className="col-span-2 text-sm font-mono text-slate-100 text-right">{formatCurrency(unit)}</div>
                            <div className="col-span-2 text-sm font-mono text-slate-100 text-right">{formatCurrency(total)}</div>
                            <div className="col-span-3 text-sm font-mono text-slate-100 text-right">-</div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Propostas referentes</div>
                    {propostasLoading ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 className="animate-spin" size={14} />
                        Carregando...
                      </div>
                    ) : propostasReferentes.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-400">Nenhuma proposta encontrada.</div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {propostasReferentes.map((p) => (
                          <div
                            key={p.id_oport}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2"
                            title={p.descricao_oport || p.id_oport}
                          >
                            <span className="text-xs font-mono text-slate-100">{p.cod_oport || p.id_oport}</span>
                            {(p.cliente || p.descricao_oport) && (
                              <span className="text-xs text-slate-400 max-w-[360px] truncate">
                                {p.cliente ? `${p.cliente}${p.descricao_oport ? ' • ' : ''}` : ''}
                                {p.descricao_oport || ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {produtoTab === 'custo_estoque' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
              {produtoTab === 'fornecedores' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
              {produtoTab === 'historicos' && (
                <div className="overflow-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10">
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</div>
                      <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</div>
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Local</div>
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</div>
                      <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Unit.</div>
                      <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</div>
                    </div>
                    {(movimentosByProdutoId[savedProduto.prod_id] || []).length === 0 ? (
                      <div className="px-4 py-4 text-xs text-slate-400">Nenhum movimento registrado.</div>
                    ) : (
                      (movimentosByProdutoId[savedProduto.prod_id] || []).map((m) => {
                        const total = m.quantidade * m.valor_unitario
                        return (
                          <div key={m.movimento_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                            <div className="col-span-2 text-sm text-slate-100 font-mono">{formatDateBR(m.data)}</div>
                            <div className="col-span-3 text-sm text-slate-100">{m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</div>
                            <div className="col-span-2 text-sm text-slate-100">{localLabel(m.local)}</div>
                            <div className="col-span-2 text-sm text-slate-100 font-mono">{m.quantidade.toLocaleString('pt-BR')}</div>
                            <div className="col-span-1 text-sm text-slate-100 font-mono text-right">{formatCurrency(m.valor_unitario)}</div>
                            <div className="col-span-2 text-sm text-slate-100 font-mono text-right">{formatCurrency(total)}</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {produtoTab === 'info_adicionais' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unidade</div>
                    <div className="text-sm font-semibold text-slate-100 mt-1 font-mono">{savedProduto.unidade_prod || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Código NCM</div>
                    <div className="text-sm font-semibold text-slate-100 mt-1 font-mono">{savedProduto.ncm_codigo || '-'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Família de Produto</div>
                    <div className="text-sm font-semibold text-slate-100 mt-1">
                      {savedProduto.familia_id ? familiasById[savedProduto.familia_id] || '-' : '-'}
                    </div>
                  </div>
                </div>
              )}

              {produtoTab === 'caracteristicas' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
              {produtoTab === 'recomendacoes_fiscais' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
              {produtoTab === 'observadores' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
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
              <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0B1220] p-4">
                <div className="relative aspect-square rounded-xl border border-white/10 bg-black/20 overflow-hidden flex items-center justify-center">
                  {getProdutoImagemUrl(savedProduto) ? (
                    <img
                      src={getProdutoImagemUrl(savedProduto) as string}
                      alt={draftDescricao || savedProduto?.descricao_prod || 'Produto'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={26} className="text-slate-500" />
                  )}
                  {imagemUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-slate-200" size={22} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePickImagem}
                  disabled={!savedProduto || imagemUploading}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-white/5 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                >
                  Alterar
                </button>
                <div className="mt-2 text-center text-[11px] text-slate-500">
                  {savedProduto?.imagem_path ? 'Imagem cadastrada' : 'Nenhuma imagem'}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código do Produto</label>
                      <div className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 font-mono">
                        {savedProduto.codigo_prod || '-'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código EAN (GTIN)</label>
                      <input
                        value={draftGtinEan}
                        onChange={(e) => setDraftGtinEan(e.target.value)}
                        className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono"
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cod de Proposta referente</label>
                      <input
                        value={draftCodPropostaRef}
                        onChange={(e) => setDraftCodPropostaRef(e.target.value)}
                        className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código EAN (GTIN)</label>
                      <input
                        value={draftGtinEan}
                        onChange={(e) => setDraftGtinEan(e.target.value)}
                        className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono"
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cod de Proposta referente</label>
                      <input
                        value={draftCodPropostaRef}
                        onChange={(e) => setDraftCodPropostaRef(e.target.value)}
                        className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                )}

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
              </div>

              <div className="lg:col-span-3" />
            </div>

            {savedProduto && (
              <>
                <div className="border-b border-white/10 overflow-x-auto custom-scrollbar">
                  <div className="flex items-center gap-1 min-w-max">
                    {PRODUTO_TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setProdutoTab(t.key)}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-colors whitespace-nowrap ${
                          produtoTab === t.key ? 'text-emerald-200 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4">
                  {produtoTab === 'estoque' && (
                    <div className="space-y-4">
                      <div className="overflow-auto">
                        <div className="min-w-[860px]">
                          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10">
                            <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Local Estoque</div>
                            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade disponível</div>
                            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Unitário</div>
                            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor Total</div>
                            <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Estoque Mínimo</div>
                          </div>
                          {(() => {
                            const qty = getSaldoLocal(savedProduto.prod_id, draftLocalEstoque)
                            const unit = parseMoneyInput(draftPreco) ?? Number(savedProduto.produto_valor ?? 0)
                            const total = qty * unit
                            return (
                              <div className="grid grid-cols-12 gap-3 px-4 py-3">
                                <div className="col-span-3 text-sm text-slate-100 truncate" title={localLabel(draftLocalEstoque)}>
                                  {localLabel(draftLocalEstoque)}
                                </div>
                                <div className="col-span-2 text-sm font-mono text-slate-100">{qty.toLocaleString('pt-BR')}</div>
                                <div className="col-span-2 text-sm font-mono text-slate-100 text-right">{formatCurrency(unit)}</div>
                                <div className="col-span-2 text-sm font-mono text-slate-100 text-right">{formatCurrency(total)}</div>
                                <div className="col-span-3 text-sm font-mono text-slate-100 text-right">-</div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Propostas referentes</div>
                        {propostasLoading ? (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="animate-spin" size={14} />
                            Carregando...
                          </div>
                        ) : propostasReferentes.length === 0 ? (
                          <div className="mt-2 text-xs text-slate-400">Nenhuma proposta encontrada.</div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {propostasReferentes.map((p) => (
                              <div
                                key={p.id_oport}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2"
                                title={p.descricao_oport || p.id_oport}
                              >
                                <span className="text-xs font-mono text-slate-100">{p.cod_oport || p.id_oport}</span>
                                {(p.cliente || p.descricao_oport) && (
                                  <span className="text-xs text-slate-400 max-w-[360px] truncate">
                                    {p.cliente ? `${p.cliente}${p.descricao_oport ? ' • ' : ''}` : ''}
                                    {p.descricao_oport || ''}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {produtoTab === 'custo_estoque' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                  {produtoTab === 'fornecedores' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                  {produtoTab === 'historicos' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                  {produtoTab === 'info_adicionais' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unidade</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 font-mono">{draftUnidade || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Código NCM</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 font-mono">{draftNcmCodigo || '-'}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Família de Produto</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1">
                          {draftFamiliaId ? familiasById[draftFamiliaId] || '-' : '-'}
                        </div>
                      </div>
                    </div>
                  )}
                  {produtoTab === 'caracteristicas' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                  {produtoTab === 'recomendacoes_fiscais' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                  {produtoTab === 'observadores' && <div className="text-xs text-slate-400">Sem dados para exibir.</div>}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isMovimentoOpen}
        onClose={() => setIsMovimentoOpen(false)}
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
              onClick={() => setIsMovimentoOpen(false)}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvarMovimento}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 transition-all active:scale-95"
            >
              Salvar Movimento
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
                onChange={(e) => setMovTipo(e.target.value === 'SAIDA' ? 'SAIDA' : 'ENTRADA')}
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
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Quantidade (PC)</label>
              <input
                value={movQuantidade}
                onChange={(e) => setMovQuantidade(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono text-right"
                placeholder="0,000000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Valor Unitário</label>
              <input
                value={movValorUnitario}
                onChange={(e) => setMovValorUnitario(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono text-right"
                placeholder="0,000000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local de Estoque</label>
              <select
                value={movLocal}
                onChange={(e) => setMovLocal(e.target.value === '04' ? '04' : '03')}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              >
                {LOCAIS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
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

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observação</label>
            <textarea
              value={movObservacao}
              onChange={(e) => setMovObservacao(e.target.value)}
              className="w-full min-h-[140px] rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500"
              placeholder=""
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Estoque
