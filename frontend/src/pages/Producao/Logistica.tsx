import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FC, WheelEvent as ReactWheelEvent } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { AlertTriangle, Calendar, Loader2, RefreshCw, Search, Truck } from 'lucide-react'
import { useUsuarios } from '@/hooks/useUsuarios'
import { CRM_Oportunidade, CRM_Status, fetchCrmFases, fetchCrmStatus, fetchOportunidades, updateOportunidade } from '@/services/crm'
import { PropostaComercialCompletaModal } from '@/components/crm/PropostaComercialCompletaModal'
import { logError } from '@/utils/logger'

type ColumnDef = { id: string; label: string; cor: string | null }
type Stage = { id: string; label: string; ordem: number; cor: string | null }
const DEFAULT_FASES_LABELS = [
  'Aguardando Materiais',
  'Análise Técnica',
  'Aguardando Aprovação',
  'Em Produção',
  'Controle de Qualidade',
  'Pronto para Faturamento',
  'Entrega Concluída',
  'Finalizado'
]

const normalizeText = (v: string) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getCodProposta = (o: CRM_Oportunidade) => String(o.cod_oport ?? o.cod_oportunidade ?? '').trim()
const getCliente = (o: CRM_Oportunidade) => String(o.cliente_nome ?? o.cliente ?? '').trim()
const getDescricao = (o: CRM_Oportunidade) => String(o.descricao_oport ?? o.descricao_oportunidade ?? '').trim()
const getOportunidadeId = (o: CRM_Oportunidade) => String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim()

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

const calcTempoAbertoLabel = (dateString?: string | null) => {
  const v = String(dateString || '').trim()
  if (!v) return '-'
  const start = new Date(v)
  if (Number.isNaN(start.getTime())) return '-'
  const ms = Date.now() - start.getTime()
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalMinutes = Math.floor(ms / (60 * 1000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  return `${days}d ${hours}h`
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
  const [fases, setFases] = useState<Stage[]>([])
  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [oportunidades, setOportunidades] = useState<CRM_Oportunidade[]>([])
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [selectedFaseIds, setSelectedFaseIds] = useState<string[]>([])
  const [faseFilterOpen, setFaseFilterOpen] = useState(false)
  const faseFilterRef = useRef<HTMLDivElement | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  const boardRef = useRef<HTMLDivElement | null>(null)

  const openDetails = (o: CRM_Oportunidade) => {
    const id = getOportunidadeId(o)
    if (!id) return
    setDetailsId(id)
    setDetailsOpen(true)
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ops, fasesRows, statusRows] = await Promise.all([fetchOportunidades(), fetchCrmFases(), fetchCrmStatus()])
      setOportunidades(Array.isArray(ops) ? ops : [])
      setFases(
        (Array.isArray(fasesRows) ? fasesRows : []).map((f: any) => ({
          id: String(f?.fase_id || f?.id || '').trim(),
          label: String(f?.fase_desc || f?.label || '').trim(),
          ordem: Number(f?.fase_ordem ?? f?.ordem ?? 999999),
          cor: String(f?.fase_cor || f?.cor || '').trim() || null
        }))
      )
      setStatuses(Array.isArray(statusRows) ? (statusRows as any) : [])
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

  const faseOptions = useMemo(() => {
    const sorted = [...(fases || [])]
      .map((f) => ({
        id: String(f.id || '').trim(),
        label: String(f.label || '').trim(),
        ordem: Number.isFinite(f.ordem as any) ? f.ordem : 999999,
        cor: String(f.cor || '').trim() || null
      }))
      .filter((f) => !!f.id && !!f.label)
      .sort((a, b) => {
        if (a.ordem !== b.ordem) return a.ordem - b.ordem
        return a.label.localeCompare(b.label, 'pt-BR')
      })
    return sorted
  }, [fases])

  const vendedorNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of usuarios as any[]) {
      if (u?.id && u?.nome) m[String(u.id)] = String(u.nome)
    }
    return m
  }, [usuarios])

  const vendedorAvatarById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of usuarios as any[]) {
      if (u?.id && u?.avatar_url) m[String(u.id)] = String(u.avatar_url)
    }
    return m
  }, [usuarios])

  const statusInfoById = useMemo(() => {
    const m = new Map<string, { desc: string; cor: string | null }>()
    for (const s of statuses || []) {
      const id = String((s as any)?.status_id || '').trim()
      if (!id) continue
      m.set(id, { desc: String((s as any)?.status_desc || '').trim() || '-', cor: String((s as any)?.status_cor || '').trim() || null })
    }
    return m
  }, [statuses])

  useEffect(() => {
    if (!loadedOnce) return
    if (selectedFaseIds.length > 0) return
    const byLabel = new Map(faseOptions.map((f) => [normalizeText(f.label), f.id]))
    const desired = Array.from(
      new Set(
        DEFAULT_FASES_LABELS.map((l) => byLabel.get(normalizeText(l)) || '')
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    )
    if (desired.length > 0) {
      setSelectedFaseIds(desired)
    } else {
      setSelectedFaseIds(faseOptions.map((f) => f.id))
    }
  }, [faseOptions, loadedOnce, selectedFaseIds.length])

  useEffect(() => {
    if (!faseFilterOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const el = faseFilterRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setFaseFilterOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFaseFilterOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [faseFilterOpen])

  const columns: ColumnDef[] = useMemo(() => {
    const selected = new Set(selectedFaseIds)
    return faseOptions
      .filter((f) => selected.has(f.id))
      .map((f) => ({ id: f.id, label: f.label, cor: f.cor }))
  }, [faseOptions, selectedFaseIds])

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
      const col = String((o as any).id_fase || '').trim()
      if (!col) continue
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

  const moveToFase = async (id: string, nextFaseId: string) => {
    if (saving) return
    setSaving(true)
    setError(null)
    const prev = oportunidades
    const faseLabel = String(faseOptions.find((f) => f.id === nextFaseId)?.label || '').trim() || null
    setOportunidades((cur) =>
      cur.map((o) => (getOportunidadeId(o) === id ? { ...o, id_fase: nextFaseId, fase: faseLabel } : o))
    )
    try {
      await updateOportunidade(id, { id_fase: nextFaseId, fase: faseLabel } as any)
    } catch (e: any) {
      if (import.meta?.env?.DEV) logError('Logistica', 'Erro ao atualizar fase', { id, nextFaseId, e })
      setOportunidades(prev)
      setError(String(e?.message || 'Erro ao atualizar fase.'))
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    void moveToFase(draggableId, destination.droppableId)
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
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Fases</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Colunas do Kanban
            </div>
          </div>
          <div ref={faseFilterRef} className="relative">
            <button
              type="button"
              onClick={() => setFaseFilterOpen((v) => !v)}
              className="h-9 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors text-sm font-bold inline-flex items-center gap-2"
            >
              <span>Fases</span>
              {selectedFaseIds.filter(Boolean).length > 0 ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200">
                  {selectedFaseIds.filter(Boolean).length}
                </span>
              ) : null}
              <span className="text-[var(--text-muted)]">▼</span>
            </button>

            {faseFilterOpen ? (
              <div className="absolute right-0 z-[200] mt-2 w-[320px] rounded-2xl border border-white/10 bg-[#0B1220] shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtro: Fases</div>
                  <button
                    type="button"
                    onClick={() => setSelectedFaseIds([])}
                    className="text-[10px] font-black uppercase tracking-widest text-rose-200 hover:text-rose-100"
                    disabled={selectedFaseIds.length === 0}
                  >
                    Limpar
                  </button>
                </div>
                <div className="max-h-[320px] overflow-auto custom-scrollbar p-2">
                  {faseOptions.map((s) => {
                      const id = String(s.id || '').trim()
                      const label = String(s.label || '').trim() || `Fase ${id.slice(0, 6)}`
                      const checked = !!id && selectedFaseIds.includes(id)
                      const cor = String((s as any)?.cor || '').trim() || null
                      return (
                        <label key={id || label} className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!id) return
                              setSelectedFaseIds((prev) => {
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
                  {faseOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-slate-400">Nenhuma fase cadastrada.</div>
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
                      ? 'Carregando fases do CRM...'
                      : fases.length
                        ? 'Nenhuma fase selecionada para exibir.'
                        : 'Não foi possível carregar as fases do CRM. Verifique o cadastro de CRM Fases e as permissões do usuário.'}
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
                          const oid = getOportunidadeId(o)
                          if (!oid) return null
                          const cod = getCodProposta(o) || '-'
                          const cliente = getCliente(o) || '-'
                          const solucao = String((o as any)?.solucao || (o as any)?.solucao_desc || '').trim() || '-'
                          const dataInclusao = String((o as any)?.criado_em || (o as any)?.data_inclusao || (o as any)?.created_at || '').trim() || null
                          const tempoAberto = calcTempoAbertoLabel(dataInclusao)

                          const vendedorId = String((o as any)?.id_vendedor ?? (o as any)?.vendedor_id ?? '').trim()
                          const vendedorNome =
                            String((o as any)?.vendedor_nome || (o as any)?.vendedor || '').trim() || (vendedorId ? String(vendedorNameById[vendedorId] || '').trim() : '') || ''
                          const vendedorAvatarUrl =
                            (vendedorId ? String(vendedorAvatarById[vendedorId] || '').trim() : '') || String((o as any)?.vendedor_avatar_url || '').trim() || ''

                          const statusId = String((o as any)?.id_status || (o as any)?.status_id || '').trim()
                          const statusFromMap = statusId ? statusInfoById.get(statusId) : null
                          const statusDesc = String((o as any)?.status || (o as any)?.status_desc || '').trim() || statusFromMap?.desc || '-'
                          const statusCor = (statusFromMap?.cor || String((o as any)?.status_cor || '').trim() || null) as string | null
                          const statusBg = statusCor ? hexToRgba(statusCor, 0.16) : undefined
                          const statusBorder = statusCor ? hexToRgba(statusCor, 0.35) : undefined

                          return (
                            <Draggable draggableId={oid} index={index} key={oid}>
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
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                                        <div>
                                          <span className="text-slate-500 font-bold uppercase tracking-widest">Tempo Aberto</span>
                                          <div className="mt-1 font-mono text-slate-200">{tempoAberto}</div>
                                        </div>
                                        <div>
                                          <span className="text-slate-500 font-bold uppercase tracking-widest">Solução</span>
                                          <div className="mt-1 font-black text-slate-200 truncate">{solucao}</div>
                                        </div>
                                      </div>

                                      <div className="mt-3 flex items-center justify-between gap-2">
                                        <span
                                          className="inline-flex items-center px-3 py-1 rounded-xl border text-[11px] font-black"
                                          style={{
                                            backgroundColor: statusBg,
                                            borderColor: statusBorder,
                                            color: statusCor || undefined
                                          }}
                                        >
                                          {statusDesc}
                                        </span>
                                        {vendedorId ? (
                                          vendedorAvatarUrl ? (
                                            <img
                                              src={vendedorAvatarUrl}
                                              alt={vendedorNome || 'Vendedor'}
                                              className="h-9 w-9 rounded-full object-cover border border-white/10"
                                            />
                                          ) : (
                                            <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 inline-flex items-center justify-center text-[11px] font-black text-slate-200">
                                              {String(vendedorNome || '?')
                                                .trim()
                                                .split(/\s+/)
                                                .slice(0, 2)
                                                .map((p) => p[0])
                                                .join('')
                                                .toUpperCase() || '?'}
                                            </div>
                                          )
                                        ) : null}
                                      </div>
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

      <PropostaComercialCompletaModal
        isOpen={detailsOpen}
        oportunidadeId={detailsId}
        usuarios={usuarios}
        onClose={() => {
          setDetailsOpen(false)
          setDetailsId(null)
        }}
      />

    </div>
  )
}

export default Logistica
