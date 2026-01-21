import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Filter,
  RefreshCw,
  Search,
  Calendar,
  User,
  Building2,
  Tag,
  AlertCircle,
  Clock,
  Layers,
  Wrench,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react'
import { useOmieServics } from '@/hooks/useOmieServics'
import { formatCurrency } from '@/utils/comercial/format'
import { Modal } from '@/components/ui'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { EquipmentList } from '@/components/producao/EquipmentList.tsx'
import type { ServicEquipamento } from '@/types/domain'

// --- Interfaces ---

interface OmieProposta {
  id_omie: string
  cod_proposta: string
  cliente?: string
  valor_proposta: number
  vendedor?: string
  solucao?: string
  data_entrega?: string
  updated_at?: string
  data_inclusao?: string
  etapa?: string | null
  status?: string
  descricao_servico?: string
  observacoes?: string
  data_alteracao?: string
  cnpj?: string | null
  endereco?: string | null
}

// --- Helpers ---

function parseValorProposta(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const getStatusColor = (status: string | undefined) => {
  const s = (status || '').toLowerCase()
  if (s.includes('aprovado')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  if (s.includes('análise') || s.includes('analise')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  if (s.includes('faturado')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
  if (s.includes('entregue')) return 'bg-slate-500/10 text-slate-500 border-slate-500/20'
  return 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border)]'
}

const isFinalized = (status?: string) => {
  if (!status) return false
  const s = status.toLowerCase()
  return s.includes('concluído') || s.includes('entregue') || s.includes('faturado') || s.includes('cancelado')
}

const getDaysUntil = (dateStr?: string, now: number = Date.now()) => {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  if (isNaN(d)) return null
  const diff = d - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const getDaysDiff = (startStr?: string, end: number = Date.now()) => {
  if (!startStr) return 0
  const start = new Date(startStr).getTime()
  if (isNaN(start)) return 0
  const diff = end - start
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

type SortKey = keyof OmieProposta | 'indicadores'
type SortConfig = { key: SortKey; direction: 'asc' | 'desc' } | null

function buildEquipmentInitialData(selected: OmieProposta): Partial<ServicEquipamento> {
  return {
    cod_proposta: selected.cod_proposta,
    cliente: selected.cliente || 'NÃO INFORMADO',
    cnpj: selected.cnpj || 'NÃO INFORMADO',
    endereco: selected.endereco || 'NÃO INFORMADO',
    solucao: selected.solucao || 'NÃO INFORMADO',
    etapa_omie: selected.status || 'NÃO INFORMADO',
    data_entrada: new Date().toISOString(),
    fase: 'ANALISE'
  }
}

const SortableTh = React.memo(
  ({
    label,
    sortKey,
    widthClass,
    sortConfig,
    onSort
  }: {
    label: string
    sortKey: SortKey
    widthClass?: string
    sortConfig: SortConfig
    onSort: (key: SortKey) => void
  }) => {
    const isActive = sortConfig?.key === sortKey
    return (
      <th
        className={`px-4 py-3 cursor-pointer hover:bg-[var(--bg-panel)] transition-colors select-none group ${widthClass || ''}`}
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          <ArrowUpDown
            size={12}
            className={`text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-cyan-500' : ''}`}
          />
        </div>
      </th>
    )
  }
)

const PropostaRow = React.memo(({ item, onSelect }: { item: OmieProposta; onSelect: (id: string) => void }) => {
  const finalized = isFinalized(item.status)

  // Calculations
  const now = Date.now()
  const dataEntrega = item.data_entrega
  const daysUntilDelivery = getDaysUntil(dataEntrega, now)

  // Dias Aberto: Today - Data Inclusao. Stop if finalized.
  const endDate = finalized ? new Date(item.data_alteracao || now).getTime() : now
  const diasAberto = getDaysDiff(item.data_inclusao, endDate)

  // Dias Parado: Today - Data Alteracao (only if not finalized)
  const diasParado = finalized ? 0 : getDaysDiff(item.data_alteracao, now)

  const handleClick = useCallback(() => {
    onSelect(item.id_omie)
  }, [item.id_omie, onSelect])

  return (
    <tr
      onClick={handleClick}
      className="group border-b border-[var(--border)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
           <span className="text-xs font-medium text-[var(--text-soft)]">{item.etapa || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit whitespace-nowrap ${getStatusColor(item.status)}`}>
              {item.status || 'SEM STATUS'}
           </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-main)]">{item.cod_proposta}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col max-w-[250px]">
            <span className="text-sm font-medium text-[var(--text-main)] truncate" title={item.cliente}>{item.cliente || '-'}</span>
            <span className="text-xs text-[var(--text-muted)] truncate" title={item.cnpj || ''}>{item.cnpj || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-[var(--text-soft)] text-xs max-w-[200px]">
            <Tag size={12} className="shrink-0" />
            <span className="truncate" title={item.solucao}>{item.solucao || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
         <span className="text-sm font-bold text-[var(--text-main)] whitespace-nowrap">
            {formatCurrency(parseValorProposta(item.valor_proposta))}
         </span>
      </td>
      <td className="px-4 py-3">
         <div className="flex items-center gap-1.5 text-xs text-[var(--text-main)]">
            <User size={12} className="text-[var(--text-muted)]" />
            <span className="truncate max-w-[120px]">{item.vendedor?.split(' ')[0] || '-'}</span>
         </div>
      </td>
      <td className="px-4 py-3">
         <div className="flex flex-col gap-1 text-xs text-[var(--text-soft)]">
            <span className="flex items-center gap-1" title="Data de Entrega">
                <Calendar size={12} /> {item.data_entrega ? new Date(item.data_entrega).toLocaleDateString() : '-'}
            </span>
            {daysUntilDelivery !== null && !finalized && (
                <span className={`text-[10px] font-bold ${daysUntilDelivery < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {daysUntilDelivery < 0 ? `Atrasado ${Math.abs(daysUntilDelivery)} dias` : `${daysUntilDelivery} dias restantes`}
                </span>
            )}
         </div>
      </td>
      <td className="px-4 py-3">
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]" title="Dias Aberto">
                <Clock size={12} />
                <span>{diasAberto}d</span>
            </div>
            
            {/* Dias Parados (Show only if not finalized and > 0) */}
            {!finalized && diasParado > 0 && (
                <div className={`flex items-center gap-1 text-xs ${diasParado > 5 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`} title="Dias sem atualização">
                    <AlertCircle size={12} />
                    <span>{diasParado}d</span>
                </div>
            )}
         </div>
      </td>
      <td className="px-4 py-3 text-right">
         <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors inline-block" />
      </td>
    </tr>
  )
})

// --- Main Component ---

const DetailsModal = React.memo(({ selected, onClose }: { selected: OmieProposta | null; onClose: () => void }) => {
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false)
  const [equipmentUpdate, setEquipmentUpdate] = useState(0)
  const [equipmentInitialData, setEquipmentInitialData] = useState<Partial<ServicEquipamento>>({})

  useEffect(() => {
    setIsEquipmentModalOpen(false)
  }, [selected?.cod_proposta])

  const openEquipmentModal = useCallback(() => {
    if (!selected) return
    setEquipmentInitialData(buildEquipmentInitialData(selected))
    setIsEquipmentModalOpen(true)
  }, [selected])

  const handleEquipmentSuccess = useCallback(() => {
    setEquipmentUpdate((prev) => prev + 1)
  }, [])

  if (!selected) return null

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Tag size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Detalhes da Proposta</span>
            <span className="text-lg font-bold text-[var(--text-main)]">{selected.cod_proposta}</span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={openEquipmentModal}
            className="px-4 py-2 bg-[var(--primary)] hover:brightness-110 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-[var(--primary)]/20"
          >
            <Wrench size={16} />
            ENTRADA DE EQUIPAMENTO
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Cliente</label>
            <div className="text-lg font-semibold text-[var(--text-main)] mb-2">{selected.cliente}</div>
            <div className="flex flex-col gap-1 text-sm text-[var(--text-soft)]">
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                {selected.cnpj || 'CNPJ não informado'}
              </div>
              {selected.endereco && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Tag size={12} />
                  {selected.endereco}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex flex-col justify-center">
            <label className="text-xs font-bold text-cyan-600/70 uppercase mb-1 block">Valor da Proposta</label>
            <div className="text-2xl font-black text-cyan-500">{formatCurrency(parseValorProposta(selected.valor_proposta))}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <AlertCircle size={16} className="text-cyan-500" />
                Status e Fase
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Status</label>
                  <div className="font-medium text-sm">{selected.status}</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Fase</label>
                  <div className="font-medium text-sm">{selected.etapa || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <Clock size={16} className="text-cyan-500" />
                Prazos e Datas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Entrega</label>
                  <div className="font-medium text-sm">{selected.data_entrega || '-'}</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Inclusão</label>
                  <div className="font-medium text-sm">{selected.data_inclusao || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col h-full gap-4">
              <div className="flex-1 p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Solução / Serviço</label>
                <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
                  {selected.solucao || 'Nenhuma solução especificada.'}
                </p>
                {selected.descricao_servico && (
                  <>
                    <div className="my-3 border-t border-[var(--border)]" />
                    <p className="text-sm text-[var(--text-soft)] whitespace-pre-wrap leading-relaxed">{selected.descricao_servico}</p>
                  </>
                )}
              </div>

              {selected.observacoes && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <label className="text-xs font-bold text-amber-600/70 uppercase mb-2 block">Observações</label>
                  <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{selected.observacoes}</p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center gap-2">
                <User size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-muted)]">Vendedor:</span>
                <span className="text-sm font-medium text-[var(--text-main)]">{selected.vendedor}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 mb-2">
            <Wrench size={16} className="text-cyan-500" />
            Equipamentos em Produção
          </h3>
          <EquipmentList codProposta={selected.cod_proposta} lastUpdate={equipmentUpdate} />
        </div>

        <EquipmentEntryModal
          key={selected.cod_proposta}
          isOpen={isEquipmentModalOpen}
          onClose={() => setIsEquipmentModalOpen(false)}
          initialData={equipmentInitialData}
          onSuccess={handleEquipmentSuccess}
        />
      </div>
    </Modal>
  )
})

const OmieKanban: React.FC = () => {
  const { items = [], loading, error, refresh } = useOmieServics()

  // State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendedor, setVendedor] = useState('all')
  const [status, setStatus] = useState('all')
  const [etapa, setEtapa] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const isRefreshingRef = useRef(false)

  // Debounce search to prevent excessive re-filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Derived Filters Options (Memoized)
  const filterOptions = useMemo(() => {
    const v = new Set<string>()
    const s = new Set<string>()
    const e = new Set<string>()

    // Ensure items is an array
    const safeItems = Array.isArray(items) ? items : []

    safeItems.forEach(item => {
        if (item.vendedor?.trim()) v.add(item.vendedor)
        if (item.status?.trim()) s.add(item.status)
        if (item.etapa?.trim()) e.add(item.etapa)
    })

    return {
        vendedores: Array.from(v).sort((a, b) => a.localeCompare(b)),
        status: Array.from(s).sort((a, b) => a.localeCompare(b)),
        etapas: Array.from(e).sort((a, b) => a.localeCompare(b))
    }
  }, [items])

  // Sort Handler
  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) => {
      const direction: 'asc' | 'desc' = prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction }
    })
  }, [])

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const safeItems = Array.isArray(items) ? items : []
    
    // 1. Filter
    let result = safeItems.filter((r) => {
      const matchSearch = !q || (r.cod_proposta || '').toLowerCase().includes(q) || (r.cliente || '').toLowerCase().includes(q)
      const matchVendedor = vendedor === 'all' || r.vendedor === vendedor
      const matchStatus = status === 'all' || r.status === status
      const matchEtapa = etapa === 'all' || r.etapa === etapa
      return matchSearch && matchVendedor && matchStatus && matchEtapa
    })

    // 2. Sort
    if (sortConfig) {
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1
      result.sort((a, b) => {
        const key = sortConfig.key

        const aValue = (() => {
          if (key === 'indicadores') return new Date(a.data_inclusao || 0).getTime()
          if (key === 'valor_proposta') return parseValorProposta(a.valor_proposta)
          const raw = a[key]
          if (typeof raw === 'string') return raw.toLowerCase()
          if (typeof raw === 'number') return raw
          return raw ? String(raw) : ''
        })()

        const bValue = (() => {
          if (key === 'indicadores') return new Date(b.data_inclusao || 0).getTime()
          if (key === 'valor_proposta') return parseValorProposta(b.valor_proposta)
          const raw = b[key]
          if (typeof raw === 'string') return raw.toLowerCase()
          if (typeof raw === 'number') return raw
          return raw ? String(raw) : ''
        })()

        if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * multiplier
        return String(aValue).localeCompare(String(bValue)) * multiplier
      })
    }

    return result
  }, [items, debouncedSearch, vendedor, status, etapa, sortConfig])

  // Derived Selected Item
  const itemsById = useMemo(() => {
    const map = new Map<string, OmieProposta>()
    for (const item of items) map.set(item.id_omie, item)
    return map
  }, [items])

  const selected = useMemo(() => (selectedId ? itemsById.get(selectedId) || null : null), [itemsById, selectedId])

  // Handlers
  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [refresh])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-[var(--bg-main)]">
      {/* --- Header --- */}
      <div className="flex-none px-4 md:px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-panel)] z-10 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          {/* Title */}
          <div className="flex items-center gap-3 min-w-max">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-main)] leading-none">Produção OMIE</h1>
              <span className="text-xs text-[var(--text-muted)] font-medium">Lista de Serviços</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            
            {/* Search */}
            <div className="relative w-full md:w-64 shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proposta, cliente..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            {/* Selects */}
            <div className="flex gap-2">
              <select
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
              >
                <option value="all">Vendedor</option>
                {filterOptions.vendedores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
              >
                <option value="all">Status</option>
                {filterOptions.status.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
              >
                <option value="all">Fase</option>
                {filterOptions.etapas.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pl-2 md:border-l md:border-[var(--border)]">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Atualizar dados"
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-soft)] hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Error Messages --- */}
      {error && (
        <div className="flex-none px-6 pt-4">
           <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
             <AlertCircle size={16} />
             {error}
           </div>
        </div>
      )}

      {/* --- List Area --- */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
             <RefreshCw size={32} className="animate-spin text-cyan-500" />
             <span className="text-sm text-[var(--text-muted)] font-medium">Carregando Propostas...</span>
          </div>
        ) : filteredItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-2xl">
                <Filter size={48} strokeWidth={1} className="mb-4 opacity-30" />
                <p>Nenhum resultado encontrado para os filtros selecionados.</p>
             </div>
        ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                            <SortableTh label="Fase" sortKey="etapa" widthClass="w-[140px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Status" sortKey="status" widthClass="w-[140px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Proposta" sortKey="cod_proposta" widthClass="w-[120px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Cliente / Empresa" sortKey="cliente" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Solução" sortKey="solucao" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Valor" sortKey="valor_proposta" widthClass="w-[120px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Vendedor" sortKey="vendedor" widthClass="w-[120px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Entrega" sortKey="data_entrega" widthClass="w-[100px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Indicadores" sortKey="indicadores" widthClass="w-[120px]" sortConfig={sortConfig} onSort={handleSort} />
                            <th className="px-4 py-3 w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-main)]">
                        {filteredItems.map(item => (
                            <PropostaRow 
                                key={item.id_omie} 
                                item={item} 
                                onSelect={handleSelect} 
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* --- Details Modal --- */}
      <DetailsModal selected={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}

export default OmieKanban
