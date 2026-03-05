import React, { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { AlertTriangle, Loader2, RefreshCw, Search, Truck } from 'lucide-react'
import { CRM_Oportunidade, CRM_Status, fetchCrmStatus, fetchOportunidades, updateOportunidade } from '@/services/crm'

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

const Logistica: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [oportunidades, setOportunidades] = useState<CRM_Oportunidade[]>([])

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

  const columns: ColumnDef[] = useMemo(() => {
    const sorted = [...statuses].sort((a, b) => {
      const ao = a.status_ordem ?? 999999
      const bo = b.status_ordem ?? 999999
      if (ao !== bo) return ao - bo
      return String(a.status_desc || '').localeCompare(String(b.status_desc || ''), 'pt-BR')
    })
    return [{ id: '__none__', label: 'Sem status' }, ...sorted.map((s) => ({ id: s.status_id, label: s.status_desc }))]
  }, [statuses])

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
      if (!map[col]) map[col] = []
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

  return (
    <div className="pt-4 pb-6 px-4 md:px-6">
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

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {columns.map((col) => {
            const items = cardsByColumn[col.id] || []
            return (
              <div
                key={col.id}
                className="w-[360px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] flex flex-col"
              >
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{col.label}</div>
                  <div className="text-xs font-bold text-[var(--text-main)]">{items.length}</div>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 flex-1 min-h-[180px] space-y-3 ${
                        snapshot.isDraggingOver ? 'bg-[var(--bg-main)]/40' : ''
                      }`}
                    >
                      {items.map((o, index) => {
                        const cod = getCodProposta(o) || '-'
                        const cliente = getCliente(o) || '-'
                        const desc = getDescricao(o)
                        return (
                          <Draggable draggableId={o.id_oport} index={index} key={o.id_oport}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
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
    </div>
  )
}

export default Logistica

