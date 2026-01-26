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
  ArrowUpDown,
  X
} from 'lucide-react'
import { useOmieServics } from '@/hooks/useOmieServics'
import { useUsuarios } from '@/hooks/useUsuarios'
import { formatCurrency } from '@/utils/comercial/format'
import { HorizontalScrollArea, Modal } from '@/components/ui'
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
  empresa_correspondente?: string | null
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
  if (!s.trim()) return 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border)]'
  const palette = [
    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'bg-lime-500/10 text-lime-400 border-lime-500/20'
  ]
  let hash = 0
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

const getEtapaColor = (etapa: string | undefined | null) => {
  const e = (etapa || '').trim().toLowerCase()
  if (!e) return 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border)]'
  const palette = [
    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
  ]
  let hash = 0
  for (let i = 0; i < e.length; i += 1) hash = (hash * 31 + e.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
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

const normalizeNome = (value: unknown) => String(value ?? '').trim().toLowerCase()

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const VendedorIdentity = React.memo(
  ({
    nome,
    avatarUrl,
    size = 28
  }: {
    nome: string
    avatarUrl?: string | null
    size?: number
  }) => {
    const initials = getInitials(nome || '')
    const px = `${size}px`
    return (
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={nome}
            referrerPolicy="no-referrer"
            className="rounded-full border border-[var(--border)] object-cover shrink-0"
            style={{ width: px, height: px }}
          />
        ) : (
          <div
            className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-soft)] font-black flex items-center justify-center shrink-0"
            style={{ width: px, height: px, fontSize: size <= 28 ? '10px' : '12px' }}
          >
            {initials}
          </div>
        )}
        <span className="text-xs text-[var(--text-main)] truncate">{nome || '-'}</span>
      </div>
    )
  }
)

function buildEquipmentInitialData(selected: OmieProposta, vendedorEmail?: string | null): Partial<ServicEquipamento> {
  return {
    cod_proposta: selected.cod_proposta,
    cliente: selected.cliente || '',
    cnpj: selected.cnpj ?? null,
    endereco: selected.endereco ?? null,
    solucao: selected.solucao ?? null,
    etapa_omie: selected.etapa || selected.status || null,
    vendedor: selected.vendedor ?? null,
    email_vendedor: vendedorEmail ?? null,
    empresa_correspondente: selected.empresa_correspondente ?? null,
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

const DualSortableTh = React.memo(
  ({
    leftLabel,
    leftKey,
    rightLabel,
    rightKey,
    widthClass,
    sortConfig,
    onSort
  }: {
    leftLabel: string
    leftKey: SortKey
    rightLabel: string
    rightKey: SortKey
    widthClass?: string
    sortConfig: SortConfig
    onSort: (key: SortKey) => void
  }) => {
    const leftActive = sortConfig?.key === leftKey
    const rightActive = sortConfig?.key === rightKey
    return (
      <th className={`px-4 py-3 hover:bg-[var(--bg-panel)] transition-colors select-none ${widthClass || ''}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="group inline-flex items-center gap-1"
            onClick={() => onSort(leftKey)}
          >
            <span className={`transition-colors ${leftActive ? 'text-cyan-400' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`}>
              {leftLabel}
            </span>
            <ArrowUpDown
              size={12}
              className={`text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ${leftActive ? 'opacity-100 text-cyan-500' : ''}`}
            />
          </button>
          <span className="text-[var(--border)]">/</span>
          <button
            type="button"
            className="group inline-flex items-center gap-1"
            onClick={() => onSort(rightKey)}
          >
            <span className={`transition-colors ${rightActive ? 'text-cyan-400' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`}>
              {rightLabel}
            </span>
            <ArrowUpDown
              size={12}
              className={`text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ${rightActive ? 'opacity-100 text-cyan-500' : ''}`}
            />
          </button>
        </div>
      </th>
    )
  }
)

const PropostaRow = React.memo(
  ({
    item,
    onSelect,
    vendedorAvatarUrl
  }: {
    item: OmieProposta
    onSelect: (id: string) => void
    vendedorAvatarUrl?: string | null
  }) => {
  const finalized = isFinalized(item.status)

  // Calculations
  const now = Date.now()
  const dataEntrega = item.data_entrega
  const daysUntilDelivery = getDaysUntil(dataEntrega, now)

  const handleClick = useCallback(() => {
    onSelect(item.id_omie)
  }, [item.id_omie, onSelect])

  return (
    <tr
      onClick={handleClick}
      className="group border-b border-[var(--border)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-main)]">{item.cod_proposta}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col max-w-[250px]">
          <span className="text-sm font-medium text-[var(--text-main)] truncate" title={item.cliente}>
            {item.cliente || '-'}
          </span>
          <span className="text-xs text-[var(--text-muted)] truncate" title={item.cnpj || ''}>
            {item.cnpj || '-'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-[var(--text-soft)] text-xs max-w-[200px]">
          <Tag size={12} className="shrink-0" />
          <span className="truncate" title={item.solucao}>
            {item.solucao || '-'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-main)]">
          <VendedorIdentity nome={item.vendedor || '-'} avatarUrl={vendedorAvatarUrl} size={26} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit whitespace-nowrap ${getEtapaColor(item.etapa)}`}>
            {item.etapa || 'NÃO INFORMADO'}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit whitespace-nowrap ${getStatusColor(item.status)}`}>
            {item.status || 'SEM STATUS'}
          </span>
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
      <td className="px-4 py-3 text-right">
         <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors inline-block" />
      </td>
    </tr>
  )
  }
)

// --- Main Component ---

const DetailsModal = React.memo(
  ({
    selected,
    onClose,
    vendedorAvatarUrl,
    vendedorEmail
  }: {
    selected: OmieProposta | null
    onClose: () => void
    vendedorAvatarUrl?: string | null
    vendedorEmail?: string | null
  }) => {
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false)
  const [equipmentUpdate, setEquipmentUpdate] = useState(0)
  const [equipmentInitialData, setEquipmentInitialData] = useState<Partial<ServicEquipamento>>({})

  useEffect(() => {
    setIsEquipmentModalOpen(false)
  }, [selected?.cod_proposta])

  const openEquipmentModal = useCallback(() => {
    if (!selected) return
    setEquipmentInitialData(buildEquipmentInitialData(selected, vendedorEmail))
    setIsEquipmentModalOpen(true)
  }, [selected, vendedorEmail])

  const handleEquipmentSuccess = useCallback(() => {
    setEquipmentUpdate((prev) => prev + 1)
  }, [])

  if (!selected) return null
  const now = Date.now()
  const finalized = isFinalized(selected.status)
  const daysUntilDelivery = getDaysUntil(selected.data_entrega, now)

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="4xl"
      title={
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Tag size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Detalhes da Proposta</span>
              <span className="text-lg font-bold text-[var(--text-main)]">{selected.cod_proposta}</span>
              <span className="text-[10px] font-medium text-[var(--text-muted)]">ID: {selected.id_omie}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${getEtapaColor(selected.etapa)}`}>
              {selected.etapa || 'ETAPA NÃO INFORMADA'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${getStatusColor(selected.status)}`}>
              {selected.status || 'SEM STATUS'}
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Cliente</label>
            <div className="text-lg font-semibold text-[var(--text-main)] mb-2">{selected.cliente || 'NÃO INFORMADO'}</div>
            <div className="flex flex-col gap-1 text-sm text-[var(--text-soft)]">
              <div className="flex items-center gap-2">
                <Building2 size={14} />
                {selected.cnpj || 'NÃO INFORMADO'}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Tag size={12} />
                {selected.endereco || 'NÃO INFORMADO'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-[var(--border)] flex flex-col justify-center">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Valor da Proposta</label>
            <div className="text-2xl font-black text-[var(--text-main)]">{formatCurrency(parseValorProposta(selected.valor_proposta))}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Empresa Correspondente</label>
          <div className="text-sm font-semibold text-[var(--text-main)]">{selected.empresa_correspondente || 'NÃO INFORMADO'}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <AlertCircle size={16} className="text-cyan-500" />
                Status e Etapa
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Status</label>
                  <div className="pt-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border w-fit inline-flex ${getStatusColor(selected.status)}`}>
                      {selected.status || 'SEM STATUS'}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Etapa</label>
                  <div className="pt-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border w-fit inline-flex ${getEtapaColor(selected.etapa)}`}>
                      {selected.etapa || 'NÃO INFORMADO'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <Clock size={16} className="text-cyan-500" />
                Prazos e Datas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Entrega</label>
                  <div className="pt-1 flex flex-col gap-1">
                    <div className="font-medium text-sm">
                      {selected.data_entrega ? new Date(selected.data_entrega).toLocaleDateString() : 'NÃO INFORMADO'}
                    </div>
                    {daysUntilDelivery !== null && !finalized && (
                      <div className={`text-[10px] font-bold ${daysUntilDelivery < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {daysUntilDelivery < 0 ? `Atrasado ${Math.abs(daysUntilDelivery)} dias` : `${daysUntilDelivery} dias restantes`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Inclusão</label>
                  <div className="font-medium text-sm pt-1">
                    {selected.data_inclusao ? new Date(selected.data_inclusao).toLocaleDateString() : 'NÃO INFORMADO'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">Alteração</label>
                  <div className="font-medium text-sm pt-1">
                    {selected.data_alteracao ? new Date(selected.data_alteracao).toLocaleDateString() : 'NÃO INFORMADO'}
                  </div>
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
                <div className="my-3 border-t border-[var(--border)]" />
                <p className="text-sm text-[var(--text-soft)] whitespace-pre-wrap leading-relaxed">
                  {selected.descricao_servico || 'Nenhuma descrição de serviço.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-rose-500/5 border border-[var(--border)]">
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Observações</label>
                <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{selected.observacoes || 'Sem observações.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center gap-2">
                <VendedorIdentity
                  nome={selected.vendedor || '-'}
                  avatarUrl={vendedorAvatarUrl}
                  size={34}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border)]">
          <div className="flex justify-end mb-3">
            <button
              onClick={openEquipmentModal}
              className="px-4 py-2 bg-[var(--primary)] hover:brightness-110 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-[var(--primary)]/20"
            >
              <Wrench size={16} />
              ENTRADA DE EQUIPAMENTO
            </button>
          </div>
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
  }
)

const Propostas: React.FC = () => {
  const { items = [], loading, error, refresh } = useOmieServics()
  const { usuarios } = useUsuarios()

  // State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendedor, setVendedor] = useState('all')
  const [status, setStatus] = useState('all')
  const [etapa, setEtapa] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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
        else e.add('NÃO INFORMADO')
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
    const norm = (val: unknown) => String(val ?? '').trim().toLowerCase()
    
    // 1. Filter
    let result = safeItems.filter((r) => {
      const matchSearch =
        !q ||
        norm(r.cod_proposta).includes(q) ||
        norm(r.cliente).includes(q) ||
        norm(r.cnpj).includes(q) ||
        norm(r.solucao).includes(q) ||
        norm(r.vendedor).includes(q)
      const matchVendedor = vendedor === 'all' || r.vendedor === vendedor
      const matchStatus = status === 'all' || r.status === status
      const rEtapa = r.etapa?.trim() ? r.etapa : 'NÃO INFORMADO'
      const matchEtapa = etapa === 'all' || norm(rEtapa) === norm(etapa)
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

  const usuariosByNome = useMemo(() => {
    const map = new Map<string, { avatar_url: string | null; email_login?: string | null; email_corporativo?: string | null }>()
    for (const u of usuarios) {
      map.set(normalizeNome(u.nome), { avatar_url: u.avatar_url, email_login: u.email_login, email_corporativo: u.email_corporativo })
    }
    return map
  }, [usuarios])

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

  const hasActiveFilters = useMemo(() => {
    return Boolean(search.trim()) || vendedor !== 'all' || status !== 'all' || etapa !== 'all' || sortConfig !== null
  }, [search, vendedor, status, etapa, sortConfig])

  const handleClearFilters = useCallback(() => {
    setSearch('')
    setDebouncedSearch('')
    setVendedor('all')
    setStatus('all')
    setEtapa('all')
    setSortConfig(null)
    searchInputRef.current?.focus()
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
              <h1 className="text-lg font-bold text-[var(--text-main)] leading-none">Propostas</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-[var(--text-muted)] font-medium">Gestão de Propostas</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-soft)]">
                  {filteredItems.length} de {items.length}
                </span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <HorizontalScrollArea className="flex flex-col md:flex-row items-stretch md:items-center gap-2 overflow-x-scroll overflow-y-hidden pb-1 md:pb-0 touch-pan-y">
            
            {/* Search */}
            <div className="relative w-full md:w-64 shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={searchInputRef}
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
                <option value="all">Etapa</option>
                {filterOptions.etapas.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pl-2 md:border-l md:border-[var(--border)]">
              <button
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                title="Limpar filtros"
                className="h-9 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-soft)] hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-50"
              >
                <X size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">Limpar</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Atualizar dados"
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-soft)] hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </HorizontalScrollArea>
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
      <HorizontalScrollArea className="flex-1 overflow-x-scroll overflow-y-auto touch-pan-y px-4 md:px-6 py-4">
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
                <table className="min-w-[1100px] w-full text-left border-collapse">
                    <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                            <SortableTh label="Proposta" sortKey="cod_proposta" widthClass="w-[140px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Cliente" sortKey="cliente" widthClass="min-w-[260px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Solução" sortKey="solucao" widthClass="min-w-[240px]" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableTh label="Vendedor" sortKey="vendedor" widthClass="min-w-[180px]" sortConfig={sortConfig} onSort={handleSort} />
                            <DualSortableTh
                              leftLabel="Etapa"
                              leftKey="etapa"
                              rightLabel="Status"
                              rightKey="status"
                              widthClass="min-w-[220px]"
                              sortConfig={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableTh label="Data Entrega" sortKey="data_entrega" widthClass="w-[150px]" sortConfig={sortConfig} onSort={handleSort} />
                            <th className="px-4 py-3 w-[40px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-main)]">
                        {filteredItems.map(item => (
                            <PropostaRow 
                                key={item.id_omie} 
                                item={item} 
                                vendedorAvatarUrl={usuariosByNome.get(normalizeNome(item.vendedor))?.avatar_url}
                                onSelect={handleSelect} 
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </HorizontalScrollArea>

      {/* --- Details Modal --- */}
      <DetailsModal
        selected={selected}
        onClose={() => setSelectedId(null)}
        vendedorAvatarUrl={usuariosByNome.get(normalizeNome(selected?.vendedor))?.avatar_url}
        vendedorEmail={usuariosByNome.get(normalizeNome(selected?.vendedor))?.email_corporativo || usuariosByNome.get(normalizeNome(selected?.vendedor))?.email_login}
      />
    </div>
  )
}

export default Propostas
