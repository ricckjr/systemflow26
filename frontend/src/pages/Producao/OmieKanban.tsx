import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  Filter,
  GripVertical,
  RefreshCw,
  Search,
  Calendar,
  User,
  Building2,
  Tag,
  AlertCircle,
  Clock,
  DollarSign,
  X,
  ChevronRight,
  MoreHorizontal,
  Layers,
  Wrench
} from 'lucide-react'
import { useOmieServics } from '@/hooks/useOmieServics'
import { updateOmieServicStatus } from '@/services/omieServics'
import { formatCurrency } from '@/utils/comercial/format'
import { Modal } from '@/components/ui'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { useProposalServices } from '@/hooks/useServicsEquipamento'

// --- Constants & Helpers ---

const EquipmentList = ({ codProposta }: { codProposta: string }) => {
    const { services, loading } = useProposalServices(codProposta)

    if (loading) return <div className="py-4 flex justify-center"><RefreshCw className="animate-spin text-[var(--text-muted)]" size={16} /></div>
    if (services.length === 0) return <div className="py-4 text-sm text-[var(--text-muted)] text-center italic border border-dashed border-[var(--border)] rounded-lg">Nenhum equipamento em produção para esta proposta.</div>

    return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-main)]">
            <table className="w-full text-sm text-left">
                <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--border)]">
                    <tr>
                        <th className="px-4 py-3">ID RST</th>
                        <th className="px-4 py-3">Modelo</th>
                        <th className="px-4 py-3">Entrada</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3">Fase</th>
                        <th className="px-4 py-3">Dias em Prod.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {services.map(s => {
                        const diasEmProducao = Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                        <tr key={s.id} className="hover:bg-[var(--bg-panel)] transition-colors">
                            <td className="px-4 py-3 font-medium text-[var(--text-main)]">{s.id_rst || 'Gerando...'}</td>
                            <td className="px-4 py-3 text-[var(--text-soft)]">{s.modelo || '-'}</td>
                            <td className="px-4 py-3 text-[var(--text-soft)]">{new Date(s.data_entrada).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-[var(--text-soft)]">{s.responsavel || '-'}</td>
                            <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-main)] uppercase">
                                    {s.etapa}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--text-soft)]">
                                {diasEmProducao} dias
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
    )
}

const ETAPAS_ORDEM = [
  { id: '10', label: 'PROPOSTA COMERCIAL', color: 'border-blue-500' },
  { id: '20', label: 'EM ANÁLISE', color: 'border-yellow-500' },
  { id: '30', label: 'APROVADO PARA EXECUÇÃO', color: 'border-emerald-500' },
  { id: '40', label: 'SEPARADO PARA FATURAR', color: 'border-purple-500' },
  { id: '50', label: 'FATURADO', color: 'border-cyan-500' },
  { id: '60', label: 'ENTREGUE', color: 'border-slate-500' },
] as const

const SEM_ETAPA_ID = '__SEM_ETAPA__'

function toDroppableId(etapaId: string | null) {
  return etapaId ? `etapa:${etapaId}` : SEM_ETAPA_ID
}

function fromDroppableId(droppableId: string): string | null {
  if (droppableId === SEM_ETAPA_ID) return null
  if (droppableId.startsWith('etapa:')) return droppableId.slice('etapa:'.length)
  return null
}

function parseValorProposta(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

interface OmieProposta {
  id_omie: string
  cod_proposta: string
  cliente?: string
  valor_proposta: number | string
  a_prazo?: string
  vendedor?: string
  empresa_correspondente?: string
  solucao?: string
  data_entrega?: string
  dias_abertos?: number
  dias_parados?: number
  updated_at?: string
  data_inclusao?: string
  id_etapa?: string | null
  status_proposta?: string
  descricao_servico?: string
  observacoes?: string
  data_alteracao?: string
}

type Column = {
  id: string
  title: string
  etapaId: string | null
  color?: string
}

// --- Components ---

const KanbanCard = React.memo(
  ({
    item,
    index,
    onClick,
  }: {
    item: OmieProposta
    index: number
    onClick: () => void
  }) => {
    const isAPrazo = item.a_prazo?.toLowerCase() === 'sim'

    return (
      <Draggable draggableId={item.id_omie} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{ ...provided.draggableProps.style }}
            onClick={(e) => {
              if (snapshot.isDragging) return
              onClick()
            }}
            className={`
              group relative mb-3 rounded-xl bg-[var(--bg-panel)] border transition-all duration-200 cursor-pointer
              ${
                snapshot.isDragging
                  ? 'z-50 shadow-2xl ring-2 ring-cyan-500 rotate-2 scale-105 border-cyan-500/50'
                  : 'border-[var(--border)] shadow-sm hover:shadow-md hover:border-cyan-500/30 hover:-translate-y-0.5'
              }
            `}
          >
            {/* Header: Code & Value */}
            <div className="flex items-center justify-between p-3 pb-2 border-b border-[var(--border)]/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border)] tracking-wider">
                  {item.cod_proposta}
                </span>
                {isAPrazo && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    A PRAZO
                  </span>
                )}
              </div>
              <div
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-grab active:cursor-grabbing p-1 -mr-1 rounded hover:bg-[var(--bg-main)] transition-colors"
                {...provided.dragHandleProps}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical size={14} />
              </div>
            </div>

            {/* Body: Client & Info */}
            <div className="p-3 pt-2">
              <h4 className="text-sm font-semibold text-[var(--text-main)] line-clamp-2 leading-snug mb-1 group-hover:text-cyan-400 transition-colors">
                {item.cliente || 'Cliente não informado'}
              </h4>
              
              <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] mb-3">
                <Tag size={12} />
                <span className="truncate max-w-[200px]">{item.solucao || 'Sem solução definida'}</span>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-soft)] bg-[var(--bg-main)]/30 p-2 rounded-lg border border-[var(--border)]/50">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <User size={10} /> Vendedor
                  </span>
                  <span className="truncate font-medium">{item.vendedor?.split(' ')[0] || '-'}</span>
                </div>
                <div className="flex flex-col gap-0.5 items-end text-right">
                  <span className="text-[var(--text-muted)] flex items-center gap-1">
                    <DollarSign size={10} /> Valor
                  </span>
                  <span className="font-bold text-[var(--text-main)]">
                     {formatCurrency(parseValorProposta(item.valor_proposta))}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer: Dates & Stats */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border)]/50 text-[10px]">
               <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1 ${(item.dias_abertos || 0) > 10 ? 'text-orange-400' : 'text-[var(--text-muted)]'}`} title="Dias abertos">
                    <Clock size={12} />
                    <span>{item.dias_abertos || 0}d</span>
                  </div>
                  <div className={`flex items-center gap-1 ${(item.dias_parados || 0) > 5 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`} title="Dias parados">
                    <AlertCircle size={12} />
                    <span>{item.dias_parados || 0}d</span>
                  </div>
               </div>
               
               <div className="flex items-center gap-1 text-[var(--text-soft)]" title={`Previsão de entrega: ${item.data_entrega || 'N/A'}`}>
                 <Calendar size={12} />
                 <span>{item.data_entrega?.slice(0, 5) || '-'}</span>
               </div>
            </div>
          </div>
        )}
      </Draggable>
    )
  }
)

const KanbanColumn = React.memo(
  ({
    column,
    items,
    onClickCard,
  }: {
    column: Column
    items: OmieProposta[]
    onClickCard: (id: string) => void
  }) => {
    const totalValue = items.reduce((acc, curr) => acc + parseValorProposta(curr.valor_proposta), 0)

    return (
      <div className="flex flex-col w-[300px] min-w-[300px] max-w-[300px] h-full">
        {/* Column Header */}
        <div className={`flex flex-col mb-3 p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm border-t-4 ${column.color || 'border-slate-500'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] line-clamp-1" title={column.title}>
              {column.title}
            </h3>
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-[var(--bg-main)] text-[var(--text-soft)] rounded-md border border-[var(--border)]">
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
             <span className="font-semibold text-[var(--text-soft)]">Total:</span>
             {formatCurrency(totalValue)}
          </div>
        </div>

        {/* Droppable Area */}
        <Droppable droppableId={column.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`
                flex-1 rounded-xl transition-colors custom-scrollbar overflow-y-auto px-1 pb-2
                ${snapshot.isDraggingOver ? 'bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/20' : ''}
              `}
            >
              {items.map((item, index) => (
                <KanbanCard
                  key={item.id_omie}
                  item={item}
                  index={index}
                  onClick={() => onClickCard(item.id_omie)}
                />
              ))}
              {provided.placeholder}
              
              {items.length === 0 && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)] opacity-40">
                  <Layers size={24} strokeWidth={1.5} />
                  <span className="text-xs mt-2 font-medium">Vazio</span>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    )
  }
)

// --- Main Component ---

const OmieKanban: React.FC = () => {
  const { items, setItems, loading, error, refresh } = useOmieServics()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendedor, setVendedor] = useState('all')
  const [cliente, setCliente] = useState('all')
  const [empresa, setEmpresa] = useState('all')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false)
  const boardScrollRef = useRef<HTMLDivElement | null>(null)

  const [isDraggingCard, setIsDraggingCard] = useState(false)
  
  // --- Drag to Scroll Logic ---
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = boardScrollRef.current
    if (!el) return
    // Evita conflito com o drag and drop dos cards ou scrollbars
    // Se o alvo for o próprio container ou áreas vazias das colunas
    // (A verificação exata pode depender da estrutura, mas geralmente mouseDown no container funciona bem)
    
    setIsDown(true)
    setStartX(e.pageX - el.offsetLeft)
    setScrollLeft(el.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDown(false)
  }

  const handleMouseUp = () => {
    setIsDown(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return
    e.preventDefault()
    const el = boardScrollRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - startX) * 1.5 // Multiplicador de velocidade
    el.scrollLeft = scrollLeft - walk
  }

  useEffect(() => {
    const el = boardScrollRef.current
    if (!el) return
    // Define cursor inicial
    el.style.cursor = isDown ? 'grabbing' : 'grab'
  }, [isDown])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const vendedores = useMemo(
    () =>
      Array.from(
        new Set(items.map((r) => r.vendedor).filter((v): v is string => !!v && !!v.trim()))
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )

  const clientes = useMemo(
    () =>
      Array.from(
        new Set(items.map((r) => r.cliente).filter((v): v is string => !!v && !!v.trim()))
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )

  const empresas = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((r) => r.empresa_correspondente)
            .filter((v): v is string => !!v && !!v.trim())
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return items.filter((r) => {
      const matchSearch = !q || (r.cod_proposta || '').toLowerCase().includes(q)
      const matchVendedor = vendedor === 'all' || r.vendedor === vendedor
      const matchCliente = cliente === 'all' || r.cliente === cliente
      const matchEmpresa = empresa === 'all' || r.empresa_correspondente === empresa
      return matchSearch && matchVendedor && matchCliente && matchEmpresa
    })
  }, [items, debouncedSearch, vendedor, cliente, empresa])

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = ETAPAS_ORDEM.map((e) => ({
      id: toDroppableId(e.id),
      title: e.label,
      etapaId: e.id,
      color: e.color
    }))
    cols.push({ id: SEM_ETAPA_ID, title: 'SEM ETAPA', etapaId: null, color: 'border-slate-500' })
    return cols
  }, [])

  const byColumn = useMemo(() => {
    const knownIds = new Set(ETAPAS_ORDEM.map((e) => e.id))
    const map: Record<string, OmieProposta[]> = {}

    for (const col of columns) map[col.id] = []

    for (const r of filtered) {
      const raw = (r.id_etapa || '').trim()
      const etapaId = raw && knownIds.has(raw) ? raw : null
      const key = toDroppableId(etapaId)
      // Cast 'r' as OmieProposta since it comes from items which we treat as OmieProposta
      map[key].push(r as unknown as OmieProposta)
    }

    for (const key of Object.keys(map)) {
      map[key] = map[key].slice().sort((a, b) => {
        const aUpdated = (a.updated_at || '').toString()
        const bUpdated = (b.updated_at || '').toString()
        if (aUpdated !== bUpdated) return bUpdated.localeCompare(aUpdated)
        const aIncl = (a.data_inclusao || '').toString()
        const bIncl = (b.data_inclusao || '').toString()
        return bIncl.localeCompare(aIncl)
      })
    }

    return map
  }, [columns, filtered])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return items.find((r) => r.id_omie === selectedId) || null
  }, [items, selectedId])

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, refresh])

  const handleBoardWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = boardScrollRef.current
    if (!el) return
    // Se o usuário estiver segurando Shift, o comportamento padrão já é horizontal, deixamos o navegador lidar
    if (e.shiftKey) return
    
    // Se o scroll for vertical (maioria dos mouses), convertemos para horizontal
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // Verifica se há espaço para rolar
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY
        // Previne o scroll da página se o board rolar
        // (Opcional, mas melhora a UX para não rolar a página inteira junto)
      }
    }
  }, [])

  const onDragStart = useCallback(() => {
    setIsDraggingCard(true)
  }, [])

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDraggingCard(false)
      const { destination, source, draggableId } = result
      if (!destination) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      const nextEtapaId = fromDroppableId(destination.droppableId)
      const etapaLabel =
        nextEtapaId === null
          ? 'SEM ETAPA'
          : ETAPAS_ORDEM.find((e) => e.id === nextEtapaId)?.label || 'SEM ETAPA'
      const nowIso = new Date().toISOString()
      setMoveError(null)

      let rollback: { id_etapa: string | null; status_proposta: string | null; updated_at: string } | null = null
      let rollbackIndex = -1

      setItems((prev) => {
        const idx = prev.findIndex((r) => r.id_omie === draggableId)
        if (idx < 0) return prev
        const current = prev[idx]
        rollback = {
          id_etapa: current.id_etapa,
          status_proposta: current.status_proposta,
          updated_at: current.updated_at,
        }
        rollbackIndex = idx
        const updated = {
          ...current,
          id_etapa: nextEtapaId,
          status_proposta: etapaLabel,
          updated_at: nowIso,
        }
        const copy = prev.slice()
        copy.splice(idx, 1)
        copy.unshift(updated)
        return copy
      })

      if (!rollback) return

      try {
        await updateOmieServicStatus({
          id_omie: draggableId,
          status_proposta: etapaLabel,
          updated_at: nowIso,
          id_etapa: nextEtapaId,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha ao atualizar status'
        setMoveError(message)
        setItems((prev) => {
          const idx = prev.findIndex((r) => r.id_omie === draggableId)
          if (idx < 0) return prev
          const current = prev[idx]
          const copy = prev.slice()
          copy.splice(idx, 1)
          const restored = { ...current, ...rollback! }
          const insertAt = rollbackIndex >= 0 ? Math.min(rollbackIndex, copy.length) : 0
          copy.splice(insertAt, 0, restored)
          return copy
        })
      }
    },
    [setItems]
  )

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
              <span className="text-xs text-[var(--text-muted)] font-medium">Kanban de Serviços</span>
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
                placeholder="Buscar proposta..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            {/* Selects */}
            <div className="flex gap-2">
              <select
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Vendedores</option>
                {vendedores.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Clientes</option>
                {clientes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="h-9 px-3 max-w-[140px] rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-main)] focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Empresas</option>
                {empresas.map((v) => (
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
      {(moveError || error) && (
        <div className="flex-none px-6 pt-4">
           <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
             <AlertCircle size={16} />
             {moveError || error}
           </div>
        </div>
      )}

      {/* --- Board Area --- */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-main)]/50 backdrop-blur-sm z-20">
             <div className="flex flex-col items-center gap-3">
               <RefreshCw size={32} className="animate-spin text-cyan-500" />
               <span className="text-sm text-[var(--text-muted)] font-medium">Carregando Kanban...</span>
             </div>
          </div>
        ) : null}

        {!loading && columns.length > 0 ? (
          <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
            <div
              ref={boardScrollRef}
              onWheel={handleBoardWheel}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={`absolute inset-0 overflow-x-auto overflow-y-hidden touch-pan-x ${
                isDraggingCard ? '' : 'scroll-smooth'
              }`}
            >
              <div className="flex h-full gap-4 px-4 md:px-6 py-6 min-w-max">
                {columns.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    items={byColumn[col.id] || []}
                    onClickCard={(id) => setSelectedId(id)}
                  />
                ))}
              </div>
            </div>
          </DragDropContext>
        ) : (
           !loading && (
             <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <Filter size={48} strokeWidth={1} className="mb-4 opacity-30" />
                <p>Nenhum resultado encontrado.</p>
             </div>
           )
        )}
      </div>

      {/* --- Details Modal --- */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelectedId(null)}
        size="4xl" // Wider modal
        title={
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Tag size={18} />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Detalhes da Proposta</span>
                <span className="text-lg font-bold text-[var(--text-main)]">{selected?.cod_proposta}</span>
             </div>
          </div>
        }
      >
        {selected && (
          <div className="space-y-6">

            {/* Action Bar */}
            <div className="flex justify-end">
                <button
                    onClick={() => setIsEquipmentModalOpen(true)}
                    className="px-4 py-2 bg-[var(--primary)] hover:brightness-110 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-[var(--primary)]/20"
                >
                    <Wrench size={16} />
                    ENTRADA DE EQUIPAMENTO
                </button>
            </div>
            
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="md:col-span-2 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Cliente</label>
                  <div className="text-lg font-semibold text-[var(--text-main)] mb-2">{selected.cliente}</div>
                  <div className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                     <Building2 size={14} />
                     {selected.empresa_correspondente || 'Empresa não informada'}
                  </div>
               </div>
               
               <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex flex-col justify-center">
                  <label className="text-xs font-bold text-cyan-600/70 uppercase mb-1 block">Valor da Proposta</label>
                  <div className="text-2xl font-black text-cyan-500">
                     {formatCurrency(parseValorProposta(selected.valor_proposta))}
                  </div>
                  {selected.a_prazo?.toLowerCase() === 'sim' && (
                     <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 w-fit">
                        A PRAZO
                     </div>
                  )}
               </div>
            </div>

            {/* Tabs / Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column */}
              <div className="space-y-6">
                 {/* Status Info */}
                 <div className="space-y-3">
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                      <AlertCircle size={16} className="text-cyan-500" />
                      Status e Etapa
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                          <label className="text-[10px] text-[var(--text-muted)] uppercase">Status</label>
                          <div className="font-medium text-sm">{selected.status_proposta}</div>
                       </div>
                       <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                          <label className="text-[10px] text-[var(--text-muted)] uppercase">Etapa ID</label>
                          <div className="font-medium text-sm">{selected.id_etapa || 'N/A'}</div>
                       </div>
                    </div>
                 </div>

                 {/* Dates */}
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
                 
                 {/* Indicators */}
                 <div className="grid grid-cols-2 gap-3">
                     <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <span className="text-sm text-[var(--text-muted)]">Dias Abertos</span>
                        <span className="text-lg font-bold text-[var(--text-main)]">{selected.dias_abertos || 0}</span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <span className="text-sm text-[var(--text-muted)]">Dias Parados</span>
                        <span className="text-lg font-bold text-[var(--text-main)]">{selected.dias_parados || 0}</span>
                     </div>
                 </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                 {/* Description */}
                 <div className="flex flex-col h-full gap-4">
                    <div className="flex-1 p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                       <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Solução / Serviço</label>
                       <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
                          {selected.solucao || 'Nenhuma solução especificada.'}
                       </p>
                       {selected.descricao_servico && (
                          <>
                            <div className="my-3 border-t border-[var(--border)]" />
                            <p className="text-sm text-[var(--text-soft)] whitespace-pre-wrap leading-relaxed">
                              {selected.descricao_servico}
                            </p>
                          </>
                       )}
                    </div>

                    {selected.observacoes && (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                         <label className="text-xs font-bold text-amber-600/70 uppercase mb-2 block">Observações</label>
                         <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">
                            {selected.observacoes}
                         </p>
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

            {/* Equipments Section */}
            <div className="pt-6 border-t border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 mb-2">
                    <Wrench size={16} className="text-cyan-500" />
                    Equipamentos em Produção
                </h3>
                <EquipmentList codProposta={selected.cod_proposta} />
            </div>

            <EquipmentEntryModal
                isOpen={isEquipmentModalOpen}
                onClose={() => setIsEquipmentModalOpen(false)}
                initialData={{
                    cod_proposta: selected.cod_proposta,
                    cliente: selected.cliente,
                    cnpj: selected.cliente, // OMIE doesn't seem to have direct CNPJ here, mapping name for now or fetch if needed
                    endereco: selected.solucao, // Mapping solution as address placeholder if needed, or fetch details
                    data_entrada: new Date().toISOString(),
                    etapa: 'ANALISE'
                }}
                onSuccess={() => {}}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default OmieKanban
