import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { AlertTriangle, Calendar, Hash, Loader2, Mail, RefreshCw, Search, Truck, User, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { EquipmentList } from '@/components/producao/EquipmentList'
import { useUsuarios } from '@/hooks/useUsuarios'
import { CRM_Oportunidade, CRM_Status, createOportunidadeComentario, fetchCrmStatus, fetchOportunidades, updateOportunidade } from '@/services/crm'

type ColumnDef = { id: string; label: string }

const normalizeText = (v: string) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getCodProposta = (o: CRM_Oportunidade) => String(o.cod_oport ?? o.cod_oportunidade ?? '').trim()
const getCliente = (o: CRM_Oportunidade) => String(o.cliente_nome ?? o.cliente ?? '').trim()
const getDescricao = (o: CRM_Oportunidade) => String(o.descricao_oport ?? o.descricao_oportunidade ?? '').trim()

const parseDateInputLocal = (dateInput?: string | null) => {
  const v = String(dateInput || '').trim().slice(0, 10)
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return new Date(y, mo - 1, d, 12, 0, 0, 0)
}

const daysUntilDateInput = (dateInput?: string | null) => {
  const target = parseDateInputLocal(dateInput)
  if (!target) return null
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)
  const diff = target.getTime() - base.getTime()
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return Number.isFinite(days) ? days : null
}

const formatDateBR = (dateString?: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('pt-BR')
}

const formatDateTimeBR = (dateString?: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR', { hour12: false })
}

const DEFAULT_STATUS_LABELS = ['AGUARDANDO MATERIAL', 'ANÁLISE TÉCNICA', 'AGUARDANDO APROVAÇÃO', 'APROVADO', 'EMBALAGEM']

const Logistica: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { usuarios } = useUsuarios()
  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [oportunidades, setOportunidades] = useState<CRM_Oportunidade[]>([])
  const [statusFilterInit, setStatusFilterInit] = useState(false)
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selected, setSelected] = useState<CRM_Oportunidade | null>(null)
  const [andamentoOpen, setAndamentoOpen] = useState(false)
  const [andamentoStatusId, setAndamentoStatusId] = useState('')
  const [andamentoObs, setAndamentoObs] = useState('')
  const [andamentoError, setAndamentoError] = useState<string | null>(null)
  const [equipmentEntryOpen, setEquipmentEntryOpen] = useState(false)
  const [equipmentLastUpdate, setEquipmentLastUpdate] = useState(0)

  const boardRef = useRef<HTMLDivElement | null>(null)
  const hScrollRef = useRef<HTMLDivElement | null>(null)
  const syncRef = useRef(false)
  const [hScrollWidth, setHScrollWidth] = useState(0)

  const openDetails = (o: CRM_Oportunidade) => {
    setSelected(o)
    setDetailsOpen(true)
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ops, sts] = await Promise.all([fetchOportunidades(), fetchCrmStatus()])
      setOportunidades(Array.isArray(ops) ? ops : [])
      setStatuses(Array.isArray(sts) ? sts : [])
    } catch (e: any) {
      setError(String(e?.message || 'Erro ao carregar dados.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const statusOptions = useMemo(() => {
    const sorted = [...statuses].sort((a, b) => {
      const ao = a.status_ordem ?? 999999
      const bo = b.status_ordem ?? 999999
      if (ao !== bo) return ao - bo
      return String(a.status_desc || '').localeCompare(String(b.status_desc || ''), 'pt-BR')
    })
    return [{ id: '__none__', label: 'Sem status' }, ...sorted.map((s) => ({ id: s.status_id, label: s.status_desc }))]
  }, [statuses])

  const statusById = useMemo(() => {
    return statusOptions.reduce((acc, s) => {
      acc[s.id] = s.label
      return acc
    }, {} as Record<string, string>)
  }, [statusOptions])

  const vendedorProfile = useMemo(() => {
    if (!selected) return null
    const id = String(selected.id_vendedor || '').trim()
    if (id) {
      const byId = usuarios.find((u) => String(u.id || '').trim() === id)
      if (byId) return byId
    }
    const name = String((selected as any).vendedor_nome || selected.vendedor_nome || selected.vendedor || '').trim()
    if (!name) return null
    return usuarios.find((u) => String(u.nome || '').trim() === name) || null
  }, [selected, usuarios])

  const equipmentInitialData = useMemo(() => {
    if (!selected) return {} as any
    return {
      cod_proposta: getCodProposta(selected),
      cliente: getCliente(selected),
      cnpj: String((selected as any).cliente_documento || selected.cliente_documento || '').trim(),
      solucao: selected.solucao
    } as any
  }, [selected])

  const canOpenEquipmentEntry = useMemo(() => {
    if (!selected) return false
    const cod = String((equipmentInitialData as any)?.cod_proposta || '').trim()
    const cliente = String((equipmentInitialData as any)?.cliente || '').trim()
    return !!cod && !!cliente && !saving
  }, [equipmentInitialData, saving, selected])

  useEffect(() => {
    if (statusFilterInit) return
    if (!statusOptions.length) return
    const normDefaults = DEFAULT_STATUS_LABELS.map((s) => normalizeText(s))
    const found = statusOptions
      .filter((s) => s.id !== '__none__')
      .filter((s) => normDefaults.includes(normalizeText(s.label)))
      .map((s) => s.id)

    if (found.length) {
      setSelectedStatusIds(found)
    } else {
      setSelectedStatusIds(statusOptions.filter((s) => s.id !== '__none__').map((s) => s.id))
    }
    setStatusFilterInit(true)
  }, [statusFilterInit, statusOptions])

  const columns: ColumnDef[] = useMemo(() => {
    const selected = new Set(selectedStatusIds)
    return statusOptions.filter((s) => selected.has(s.id)).map((s) => ({ id: s.id, label: s.label }))
  }, [selectedStatusIds, statusOptions])

  const filteredOportunidades = useMemo(() => {
    const term = normalizeText(search)
    if (!term) return oportunidades
    return oportunidades.filter((o) => {
      const hay = normalizeText(`${getCodProposta(o)} ${getCliente(o)} ${getDescricao(o)} ${(o.id_integ || '').toString()}`)
      return hay.includes(term)
    })
  }, [oportunidades, search])

  const cardsByColumn = useMemo(() => {
    const map: Record<string, CRM_Oportunidade[]> = {}
    for (const c of columns) map[c.id] = []
    for (const o of filteredOportunidades) {
      const col = String(o.id_status || '').trim() || '__none__'
      if (!map[col]) continue
      map[col].push(o)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const at = new Date(String(b.data_alteracao ?? b.atualizado_em ?? b.data_inclusao ?? b.criado_em ?? '')).getTime()
        const bt = new Date(String(a.data_alteracao ?? a.atualizado_em ?? a.data_inclusao ?? a.criado_em ?? '')).getTime()
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
        return getCodProposta(a).localeCompare(getCodProposta(b), 'pt-BR')
      })
    }
    return map
  }, [columns, filteredOportunidades])

  const moveToStatus = async (id: string, nextStatusId: string | null) => {
    if (saving) return
    setSaving(true)
    setError(null)
    const prev = oportunidades
    setOportunidades((cur) => cur.map((o) => (o.id_oport === id ? { ...o, id_status: nextStatusId } : o)))
    try {
      await updateOportunidade(id, { id_status: nextStatusId } as any)
    } catch (e: any) {
      setOportunidades(prev)
      setError(String(e?.message || 'Erro ao atualizar status.'))
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    const next = destination.droppableId === '__none__' ? null : destination.droppableId
    void moveToStatus(draggableId, next)
  }

  const getColumnTheme = (label: string) => {
    const k = normalizeText(label)
    if (k.includes('aprovado')) return { border: 'border-emerald-500/25', header: 'bg-emerald-500/10', badge: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20' }
    if (k.includes('aguardando') && k.includes('material'))
      return { border: 'border-amber-500/25', header: 'bg-amber-500/10', badge: 'text-amber-200 bg-amber-500/10 border-amber-500/20' }
    if (k.includes('analise') || k.includes('análise'))
      return { border: 'border-sky-500/25', header: 'bg-sky-500/10', badge: 'text-sky-200 bg-sky-500/10 border-sky-500/20' }
    if (k.includes('aguardando') && k.includes('aprovacao'))
      return { border: 'border-violet-500/25', header: 'bg-violet-500/10', badge: 'text-violet-200 bg-violet-500/10 border-violet-500/20' }
    const palette = [
      { border: 'border-teal-500/25', header: 'bg-teal-500/10', badge: 'text-teal-200 bg-teal-500/10 border-teal-500/20' },
      { border: 'border-fuchsia-500/25', header: 'bg-fuchsia-500/10', badge: 'text-fuchsia-200 bg-fuchsia-500/10 border-fuchsia-500/20' },
      { border: 'border-indigo-500/25', header: 'bg-indigo-500/10', badge: 'text-indigo-200 bg-indigo-500/10 border-indigo-500/20' },
      { border: 'border-lime-500/25', header: 'bg-lime-500/10', badge: 'text-lime-200 bg-lime-500/10 border-lime-500/20' },
      { border: 'border-orange-500/25', header: 'bg-orange-500/10', badge: 'text-orange-200 bg-orange-500/10 border-orange-500/20' },
      { border: 'border-rose-500/25', header: 'bg-rose-500/10', badge: 'text-rose-200 bg-rose-500/10 border-rose-500/20' },
    ]
    let hash = 0
    for (let i = 0; i < k.length; i++) hash = (hash * 31 + k.charCodeAt(i)) >>> 0
    return palette[hash % palette.length]
  }

  useEffect(() => {
    const board = boardRef.current
    const bar = hScrollRef.current
    if (!board || !bar) return

    const sync = (from: 'board' | 'bar') => {
      if (syncRef.current) return
      syncRef.current = true
      if (from === 'board') bar.scrollLeft = board.scrollLeft
      else board.scrollLeft = bar.scrollLeft
      syncRef.current = false
    }

    const onBoard = () => sync('board')
    const onBar = () => sync('bar')
    board.addEventListener('scroll', onBoard, { passive: true })
    bar.addEventListener('scroll', onBar, { passive: true })

    const updateWidth = () => {
      const w = Math.max(board.scrollWidth, board.clientWidth)
      setHScrollWidth(w)
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(board)

    return () => {
      board.removeEventListener('scroll', onBoard)
      bar.removeEventListener('scroll', onBar)
      ro.disconnect()
    }
  }, [columns.length, statusOptions.length])

  return (
    <div className="pt-4 pb-0 px-4 md:px-6 flex flex-col h-[calc(100vh-64px)] min-h-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
          <Truck size={14} />
          Logística
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código da proposta, cliente ou descrição..."
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-muted)] flex items-center justify-between">
          <span>Total</span>
          <span className="font-bold text-[var(--text-main)]">{filteredOportunidades.length}</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Status</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Colunas do Kanban
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const normDefaults = DEFAULT_STATUS_LABELS.map((s) => normalizeText(s))
                const found = statusOptions
                  .filter((s) => s.id !== '__none__')
                  .filter((s) => normDefaults.includes(normalizeText(s.label)))
                  .map((s) => s.id)
                setSelectedStatusIds(found)
              }}
              className="h-9 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors text-sm font-bold"
            >
              Padrão
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusIds(statusOptions.filter((s) => s.id !== '__none__').map((s) => s.id))}
              className="h-9 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors text-sm font-bold"
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      <DragDropContext onDragEnd={onDragEnd}>
        <div ref={boardRef} className="flex-1 min-h-0 flex gap-4 overflow-x-auto pb-16 custom-scrollbar">
          {columns.map((col) => {
            const items = cardsByColumn[col.id] || []
            const theme = getColumnTheme(col.label)
            return (
              <div
                key={col.id}
                className={`w-[360px] shrink-0 rounded-2xl border bg-[var(--bg-panel)] flex flex-col h-full min-h-0 ${theme.border}`}
              >
                <div className={`px-4 py-3 border-b border-[var(--border)] flex items-center justify-between ${theme.header}`}>
                  <div className="text-[11px] font-black uppercase tracking-widest text-[var(--text-main)]">{col.label}</div>
                  <div className={`text-[10px] font-black px-2 py-1 rounded-lg border ${theme.badge}`}>{items.length}</div>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 ${
                        snapshot.isDraggingOver ? 'bg-[var(--bg-main)]/40' : ''
                      }`}
                    >
                      {items.map((o, index) => {
                        const cod = getCodProposta(o) || '-'
                        const cliente = getCliente(o) || '-'
                        const desc = getDescricao(o)
                        const prevEntrega = String((o as any).prev_entrega || '').trim()
                        const diasEntrega = daysUntilDateInput(prevEntrega)
                        const entregaBadge =
                          diasEntrega === null
                            ? null
                            : diasEntrega < 0
                              ? 'text-rose-200 bg-rose-500/10 border-rose-500/20'
                              : diasEntrega <= 3
                                ? 'text-rose-200 bg-rose-500/10 border-rose-500/20'
                                : diasEntrega <= 7
                                  ? 'text-amber-200 bg-amber-500/10 border-amber-500/20'
                                  : 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20'
                        const entregaLabel =
                          diasEntrega === null
                            ? null
                            : diasEntrega < 0
                              ? `Atrasado ${Math.abs(diasEntrega)}d`
                              : diasEntrega === 0
                                ? 'Entrega hoje'
                                : `Entrega em ${diasEntrega}d`
                        return (
                          <Draggable draggableId={o.id_oport} index={index} key={o.id_oport}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => openDetails(o)}
                                className={`rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3 transition-colors ${
                                  dragSnapshot.isDragging ? 'shadow-xl shadow-black/20' : 'hover:bg-[var(--bg-panel)]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate">
                                      {cod}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-[var(--text-main)] truncate">{cliente}</div>
                                    {desc ? (
                                      <div className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">{desc}</div>
                                    ) : null}
                                    {entregaBadge && entregaLabel ? (
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[11px] font-black ${entregaBadge}`}>
                                          <Calendar size={14} />
                                          {entregaLabel}
                                        </span>
                                        <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatDateBR(prevEntrega)}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                  {saving ? (
                                    <Loader2 className="animate-spin text-[var(--text-muted)]" size={16} />
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      <div className="sticky bottom-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-t border-white/5 bg-[#0B1220]/85 backdrop-blur">
        <div ref={hScrollRef} className="h-5 overflow-x-auto overflow-y-hidden custom-scrollbar rounded-lg bg-white/5 border border-white/10">
          <div style={{ width: hScrollWidth ? `${hScrollWidth}px` : '0px', height: '1px' }} />
        </div>
      </div>

      <Modal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setSelected(null)
        }}
        size="4xl"
        title={
          selected ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                  <Truck size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Proposta Comercial</div>
                  <div className="mt-1 text-lg font-black text-[var(--text-main)] truncate">{getCodProposta(selected) || '-'}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{getCliente(selected) || '-'}</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-main)] uppercase whitespace-nowrap">
                {String(statusById[String(selected.id_status || '').trim()] || '').trim() || 'Sem status'}
              </span>
            </div>
          ) : (
            'Proposta Comercial'
          )
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDetailsOpen(false)
                setSelected(null)
              }}
              className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (!selected) return
                setAndamentoError(null)
                setAndamentoObs('')
                setAndamentoStatusId(String(selected.id_status || ''))
                setAndamentoOpen(true)
              }}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-95 inline-flex items-center gap-2 disabled:opacity-50"
            >
              NOVO ANDAMENTO
            </button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <Hash size={14} />
                  Código
                </div>
                <div className="mt-2 text-2xl font-black text-[var(--text-main)]">{getCodProposta(selected) || '-'}</div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4 lg:col-span-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <User size={14} />
                  Nome Cliente
                </div>
                <div className="mt-2 text-lg font-black text-[var(--text-main)]">{getCliente(selected) || '-'}</div>
                {String((selected as any).cliente_documento || selected.cliente_documento || '').trim() ? (
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {String((selected as any).cliente_documento || selected.cliente_documento || '').trim()}
                  </div>
                ) : null}
              </div>
            </div>

            {getDescricao(selected) ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Solicitação do cliente</div>
                <div className="mt-2 text-sm text-[var(--text-main)] whitespace-pre-wrap">{getDescricao(selected)}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Status</div>
                <div className="mt-2 text-base font-black text-[var(--text-main)]">
                  {String(statusById[String(selected.id_status || '').trim()] || '').trim() || 'Sem status'}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Solução</div>
                <div className="mt-2 text-base font-black text-[var(--text-main)]">{String(selected.solucao || '-')}</div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Frete</div>
                <div className="mt-2 text-base font-black text-[var(--text-main)]">{String((selected as any).tipo_frete || '-')}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4 lg:col-span-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Vendedor</div>
                <div className="mt-2 text-base font-black text-[var(--text-main)]">
                  {String(vendedorProfile?.nome || (selected as any).vendedor_nome || selected.vendedor_nome || selected.vendedor || '-')}
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                  <div className="inline-flex items-center gap-2">
                    <Mail size={14} />
                    {String(vendedorProfile?.email_corporativo || vendedorProfile?.email_login || '-')}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Hash size={14} />
                    Ramal {String(vendedorProfile?.ramal || '-')}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Datas</div>
                <div className="mt-2 text-xs text-[var(--text-muted)] space-y-1">
                  <div className="inline-flex items-center gap-2">
                    <Calendar size={14} />
                    Inclusão: {formatDateTimeBR(selected.data_inclusao || (selected as any).criado_em)}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Calendar size={14} />
                    Previsão entrega: {formatDateBR(selected.prev_entrega)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Equipamentos</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">Entradas vinculadas à proposta</div>
                </div>
                <button
                  type="button"
                  disabled={!canOpenEquipmentEntry}
                  onClick={() => setEquipmentEntryOpen(true)}
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.99] ${
                    canOpenEquipmentEntry
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'
                      : 'bg-white/5 border border-white/10 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Wrench size={16} />
                  Entrada de Equipamento
                </button>
              </div>
              <div className="mt-4">
                {String((equipmentInitialData as any)?.cod_proposta || '').trim() ? (
                  <EquipmentList
                    codProposta={String((equipmentInitialData as any)?.cod_proposta || '').trim()}
                    lastUpdate={equipmentLastUpdate}
                  />
                ) : (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 text-sm text-[var(--text-muted)]">
                    Código da proposta não informado para vincular equipamentos.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <EquipmentEntryModal
        isOpen={equipmentEntryOpen}
        onClose={() => setEquipmentEntryOpen(false)}
        initialData={equipmentInitialData}
        onSuccess={() => {
          setEquipmentLastUpdate(Date.now())
        }}
      />

      <Modal
        isOpen={andamentoOpen}
        onClose={() => setAndamentoOpen(false)}
        title="Andamento"
        size="sm"
        zIndex={210}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAndamentoOpen(false)}
              className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!selected) return
                const next = andamentoStatusId.trim()
                if (!next) {
                  setAndamentoError('Selecione um status.')
                  return
                }
                setAndamentoError(null)
                await moveToStatus(selected.id_oport, next)
                const obs = andamentoObs.trim()
                if (obs) {
                  try {
                    await createOportunidadeComentario(selected.id_oport, obs)
                  } catch {
                  }
                }
                setAndamentoOpen(false)
              }}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              Confirmar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {andamentoError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{andamentoError}</div>
          ) : null}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Status</label>
            <select
              value={andamentoStatusId}
              onChange={(e) => setAndamentoStatusId(e.target.value)}
              className="w-full rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
            >
              <option value="">-</option>
              {statusOptions
                .filter((s) => s.id !== '__none__')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Observação</label>
            <textarea
              value={andamentoObs}
              onChange={(e) => setAndamentoObs(e.target.value)}
              className="w-full h-28 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-[var(--text-muted)]"
              placeholder="Descreva o andamento..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Logistica
