import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FC, WheelEvent as ReactWheelEvent } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { AlertTriangle, Calendar, Hash, Loader2, Mail, RefreshCw, Search, Truck, User, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { EquipmentList } from '@/components/producao/EquipmentList'
import { useUsuarios } from '@/hooks/useUsuarios'
import { CRM_Oportunidade, CRM_Status, createOportunidadeComentario, fetchCrmStatus, fetchOportunidades, updateOportunidade } from '@/services/crm'
import { logError } from '@/utils/logger'

type ColumnDef = { id: string; label: string; cor: string | null }

const ATIVOS_STATUS_ID = 'd2649868-1c22-49bd-ac81-56b6a0e7aff7'
const ATIVOS_STATUS_LABEL = 'Ativos'

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

const normalizeWheelDelta = (delta: number, deltaMode: number, target: HTMLElement) => {
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * target.clientHeight
  return delta
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = (hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const Logistica: FC = () => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { usuarios } = useUsuarios()
  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [oportunidades, setOportunidades] = useState<CRM_Oportunidade[]>([])
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([])
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selected, setSelected] = useState<CRM_Oportunidade | null>(null)
  const [andamentoOpen, setAndamentoOpen] = useState(false)
  const [andamentoStatusId, setAndamentoStatusId] = useState('')
  const [andamentoObs, setAndamentoObs] = useState('')
  const [andamentoError, setAndamentoError] = useState<string | null>(null)
  const [equipmentEntryOpen, setEquipmentEntryOpen] = useState(false)
  const [equipmentLastUpdate, setEquipmentLastUpdate] = useState(0)

  const boardRef = useRef<HTMLDivElement | null>(null)

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
      if (import.meta?.env?.DEV) logError('Logistica', 'Erro ao carregar dados', e)
      setError(String(e?.message || 'Erro ao carregar dados.'))
    } finally {
      setLoading(false)
      setLoadedOnce(true)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const statusOptions = useMemo(() => {
    const forcedAtivos: CRM_Status = {
      status_id: ATIVOS_STATUS_ID as any,
      status_desc: ATIVOS_STATUS_LABEL as any,
      status_obs: null as any,
      status_ordem: -1 as any,
      status_cor: null as any,
      integ_id: null as any,
      criado_em: null as any,
      atualizado_em: null as any
    } as any
    const merged = (() => {
      const hasAtivos = statuses.some((s) => String((s as any)?.status_id || '').trim() === ATIVOS_STATUS_ID)
      return hasAtivos ? statuses : [forcedAtivos, ...statuses]
    })()
    const sorted = [...merged].sort((a, b) => {
      const ao = a.status_ordem ?? 999999
      const bo = b.status_ordem ?? 999999
      if (ao !== bo) return ao - bo
      return String(a.status_desc || '').localeCompare(String(b.status_desc || ''), 'pt-BR')
    })
    return sorted.map((s) => ({ id: String(s.status_id || '').trim(), label: String(s.status_desc || '').trim() }))
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
    const email = String((vendedorProfile as any)?.email_login || (vendedorProfile as any)?.email_corporativo || '').trim()
    return {
      cod_proposta: getCodProposta(selected),
      cliente: getCliente(selected),
      cnpj: String((selected as any).cliente_documento || selected.cliente_documento || '').trim(),
      solucao: selected.solucao,
      vendedor: String((selected as any).vendedor_nome || selected.vendedor_nome || selected.vendedor || (vendedorProfile as any)?.nome || '').trim() || null,
      email_vendedor: email || null,
      empresa_correspondente: String((selected as any).empresa_correspondente || '').trim() || null
    } as any
  }, [selected, vendedorProfile])

  const canOpenEquipmentEntry = useMemo(() => {
    if (!selected) return false
    const cod = String((equipmentInitialData as any)?.cod_proposta || '').trim()
    const cliente = String((equipmentInitialData as any)?.cliente || '').trim()
    return !!cod && !!cliente && !saving
  }, [equipmentInitialData, saving, selected])

  useEffect(() => {
    if (!loadedOnce) return
    if (selectedStatusIds.length > 0) return
    const all = statusOptions.map((s) => String(s.id || '').trim()).filter(Boolean)
    setSelectedStatusIds(all)
  }, [loadedOnce, selectedStatusIds.length, statusOptions])

  const fixedMissingStatusRef = useRef(false)
  useEffect(() => {
    if (!loadedOnce) return
    if (fixedMissingStatusRef.current) return
    if (!Array.isArray(oportunidades) || oportunidades.length === 0) return

    const missingIds = oportunidades
      .filter((o) => !String((o as any)?.id_status || '').trim())
      .map((o) => String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim())
      .filter(Boolean)

    if (missingIds.length === 0) {
      fixedMissingStatusRef.current = true
      return
    }

    fixedMissingStatusRef.current = true
    setOportunidades((cur) =>
      cur.map((o) => {
        const id = String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim()
        if (!id || !missingIds.includes(id)) return o
        return { ...o, id_status: ATIVOS_STATUS_ID } as any
      })
    )

    ;(async () => {
      const queue = [...missingIds]
      const workerCount = Math.min(3, queue.length)
      const workers = Array.from({ length: workerCount }).map(async () => {
        while (queue.length) {
          const id = queue.shift()
          if (!id) continue
          try {
            await updateOportunidade(id, { id_status: ATIVOS_STATUS_ID } as any)
          } catch (e: any) {
            if (import.meta?.env?.DEV) logError('Logistica', 'Falha ao corrigir status ausente', { id, e })
          }
        }
      })
      await Promise.all(workers)
    })()
  }, [loadedOnce, oportunidades])

  useEffect(() => {
    if (!statusFilterOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const el = statusFilterRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setStatusFilterOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStatusFilterOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statusFilterOpen])

  const columns: ColumnDef[] = useMemo(() => {
    const selected = new Set(selectedStatusIds)
    return statusOptions
      .filter((s) => selected.has(s.id))
      .map((s) => {
        const id = String(s.id || '').trim()
        const st = statuses.find((x) => String((x as any)?.status_id || '').trim() === id) || null
        const cor = String((st as any)?.status_cor || '').trim() || null
        return { id, label: s.label, cor }
      })
  }, [selectedStatusIds, statusOptions, statuses])

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
      const col = String((o as any).id_status || '').trim() || ATIVOS_STATUS_ID
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

  const onKanbanWheelCapture = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return
    if (e.ctrlKey) return

    const rawTarget = e.target as HTMLElement | null
    if (!rawTarget) return

    const board = e.currentTarget as HTMLElement | null
    const cardsDirect = rawTarget.closest('[data-kanban-cards="1"]') as HTMLElement | null
    const col = rawTarget.closest('[data-kanban-col="1"]') as HTMLElement | null
    const cards = cardsDirect || (col ? (col.querySelector('[data-kanban-cards="1"]') as HTMLElement | null) : null)

    const absX = Math.abs(e.deltaX)
    const absY = Math.abs(e.deltaY)
    if (absX > absY) {
      if (!board) return
      if (board.scrollWidth <= board.clientWidth) return
      if (e.deltaX === 0) return
      e.preventDefault()
      board.scrollLeft += normalizeWheelDelta(e.deltaX, e.deltaMode, board)
      return
    }

    if (!cards) return
    if (cards.scrollHeight <= cards.clientHeight) return
    if (e.deltaY === 0) return
    e.preventDefault()
    cards.scrollTop += normalizeWheelDelta(e.deltaY, e.deltaMode, cards)
  }, [])

  const moveToStatus = async (id: string, nextStatusId: string | null) => {
    if (saving) return
    setSaving(true)
    setError(null)
    const prev = oportunidades
    setOportunidades((cur) => cur.map((o) => (o.id_oport === id ? { ...o, id_status: nextStatusId } : o)))
    try {
      await updateOportunidade(id, { id_status: nextStatusId } as any)
    } catch (e: any) {
      if (import.meta?.env?.DEV) logError('Logistica', 'Erro ao atualizar status', { id, nextStatusId, e })
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
    void moveToStatus(draggableId, destination.droppableId)
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
          <div ref={statusFilterRef} className="relative">
            <button
              type="button"
              onClick={() => setStatusFilterOpen((v) => !v)}
              className="h-9 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors text-sm font-bold inline-flex items-center gap-2"
            >
              <span>Status</span>
              {selectedStatusIds.filter(Boolean).length > 0 ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200">
                  {selectedStatusIds.filter(Boolean).length}
                </span>
              ) : null}
              <span className="text-[var(--text-muted)]">▼</span>
            </button>

            {statusFilterOpen ? (
              <div className="absolute right-0 z-[200] mt-2 w-[320px] rounded-2xl border border-white/10 bg-[#0B1220] shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtro: Status</div>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusIds([])}
                    className="text-[10px] font-black uppercase tracking-widest text-rose-200 hover:text-rose-100"
                    disabled={selectedStatusIds.length === 0}
                  >
                    Limpar
                  </button>
                </div>
                <div className="max-h-[320px] overflow-auto custom-scrollbar p-2">
                  {statusOptions.map((s) => {
                      const id = String(s.id || '').trim()
                      const label = String(s.label || '').trim() || `Status ${id.slice(0, 6)}`
                      const checked = !!id && selectedStatusIds.includes(id)
                      const st = statuses.find((x) => String((x as any)?.status_id || '').trim() === id) || null
                      const cor = String((st as any)?.status_cor || '').trim() || null
                      return (
                        <label key={id || label} className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!id) return
                              setSelectedStatusIds((prev) => {
                                if (prev.includes(id)) return prev.filter((x) => x !== id)
                                return [...prev, id]
                              })
                            }}
                            className="h-4 w-4 accent-cyan-500"
                          />
                          {cor ? <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cor }} /> : null}
                          <span className="text-xs font-bold text-slate-200">{label}</span>
                        </label>
                      )
                    })}
                  {statusOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-slate-400">Nenhum status cadastrado.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
        <div
          ref={boardRef}
          className="flex-1 min-h-0 overflow-x-scroll overflow-y-hidden pb-2 kanban-x-scrollbar touch-pan-y"
          onWheelCapture={onKanbanWheelCapture}
        >
          <div className="flex h-full gap-4 min-w-[1400px] px-1">
          {!columns.length ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="max-w-xl w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-amber-100 flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-black">Kanban sem colunas</div>
                  <div className="mt-1 text-xs text-amber-100/80">
                    {loading
                      ? 'Carregando status do CRM...'
                      : statuses.length
                        ? 'Nenhum status selecionado para exibir.'
                        : 'Não foi possível carregar os status do CRM. Verifique o cadastro de CRM Status e as permissões do usuário.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {columns.map((col) => {
            const items = cardsByColumn[col.id] || []
            const theme = getColumnTheme(col.label)
            const borderBottomColor = col.cor ? hexToRgba(col.cor, 0.55) : undefined
            const headerBg = col.cor ? hexToRgba(col.cor, 0.08) : undefined
            const colBg = col.cor ? hexToRgba(col.cor, 0.05) : undefined
            return (
              <div
                key={col.id}
                className="flex flex-col w-80 shrink-0 h-full min-h-0"
                data-kanban-col="1"
              >
                <div
                  className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-b-2 bg-[#0F172A] border-white/5"
                  style={{
                    borderBottomColor: borderBottomColor,
                    backgroundColor: headerBg
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: col.cor || undefined }}>
                      {col.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${theme.badge}`}>{items.length}</span>
                </div>

                <div
                  className="flex flex-col flex-1 min-h-0 rounded-xl bg-slate-900/20 border border-white/5 p-2 transition-colors"
                  style={{ backgroundColor: colBg }}
                >
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        data-kanban-cards="1"
                        className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 min-h-[100px] transition-colors ${
                          snapshot.isDraggingOver ? 'bg-white/5 rounded-lg' : ''
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
                                  className={`
                                    group relative flex flex-col gap-2 p-4 mb-3 rounded-xl border transition-all duration-200
                                    ${dragSnapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500 rotate-2 scale-105 z-50 bg-[#1E293B]' : 'bg-[#0F172A] border-white/5 shadow-sm hover:shadow-md hover:border-white/10'}
                                  `}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">{cod}</div>
                                      <div className="mt-1 text-sm font-bold text-slate-100 truncate">{cliente}</div>
                                      {desc ? <div className="mt-1 text-xs text-slate-400 line-clamp-2">{desc}</div> : null}
                                      {entregaBadge && entregaLabel ? (
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[11px] font-black ${entregaBadge}`}>
                                            <Calendar size={14} />
                                            {entregaLabel}
                                          </span>
                                          <span className="text-[11px] text-slate-400 font-mono">{formatDateBR(prevEntrega)}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    {saving ? <Loader2 className="animate-spin text-slate-500" size={16} /> : null}
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
              </div>
            )
          })}
          </div>
        </div>
      </DragDropContext>

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
                  } catch (e: any) {
                    if (import.meta?.env?.DEV) logError('Logistica', 'Falha ao criar comentário de andamento', e)
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
              {statusOptions.map((s) => (
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
