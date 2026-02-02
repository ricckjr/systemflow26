import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Building2, 
  Loader2
} from 'lucide-react'
import {
  CRM_Oportunidade,
  CRM_Status,
  CRM_Produto,
  CRM_Servico,
  CRM_Motivo,
  CRM_OrigemLead,
  fetchCrmFases,
  fetchCrmMotivos,
  fetchCrmOrigensLead,
  fetchCrmProdutos,
  fetchCrmServicos,
  fetchCrmStatus,
  fetchOportunidades,
  updateOportunidade,
  createOportunidade
} from '@/services/crm'
import { HorizontalScrollArea, Modal } from '@/components/ui'

type Stage = { id: string; label: string; ordem: number; cor: string | null }

const FALLBACK_STAGES: Stage[] = [
  { id: 'Lead', label: 'Lead', ordem: 10, cor: '#94a3b8' },
  { id: 'Prospecção', label: 'Prospecção', ordem: 20, cor: '#60a5fa' },
  { id: 'Apresentação', label: 'Apresentação', ordem: 30, cor: '#818cf8' },
  { id: 'Qualificação', label: 'Qualificação', ordem: 40, cor: '#a78bfa' },
  { id: 'Negociação', label: 'Negociação', ordem: 50, cor: '#fbbf24' },
  { id: 'Conquistado', label: 'Conquistado', ordem: 60, cor: '#34d399' },
  { id: 'Perdidos', label: 'Perdidos', ordem: 70, cor: '#fb7185' },
  { id: 'Pós-Venda', label: 'Pós-Venda', ordem: 80, cor: '#22d3ee' }
]

const hexToRgba = (hex: string, alpha: number) => {
  const h = (hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'R$ 0,00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR')
}

// Componente do Cartão de Oportunidade
const OpportunityCard = ({
  opportunity,
  index,
  onOpen
}: {
  opportunity: CRM_Oportunidade
  index: number
  onOpen: (id: string) => void
}) => {
  const id = opportunity.id_oport || (opportunity as any).id_oportunidade
  const clienteLabel =
    opportunity.cliente ||
    (opportunity.id_cliente ? `Cliente #${String(opportunity.id_cliente).split('-')[0]}` : null) ||
    'Novo Cliente'
  const contatoLabel =
    opportunity.nome_contato ||
    (opportunity.id_contato ? `Contato #${String(opportunity.id_contato).split('-')[0]}` : null) ||
    null
  const valor = opportunity.ticket_valor ?? (opportunity.valor_proposta ? Number.parseFloat(String(opportunity.valor_proposta).replace(',', '.')) : null)

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onDoubleClick={() => onOpen(id)}
          className={`
            group relative flex flex-col gap-3 p-4 mb-3 rounded-xl border transition-all duration-200
            ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500 rotate-2 scale-105 z-50 bg-[#1E293B]' : 'bg-[#0F172A] border-white/5 shadow-sm hover:shadow-md hover:border-white/10'}
          `}
        >
          {/* Header: Cliente e Valor */}
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-100 truncate" title={opportunity.cliente || 'Sem cliente'}>
                {clienteLabel}
              </h4>
              {contatoLabel ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 size={10} className="text-slate-500" />
                  <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                    {contatoLabel}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="shrink-0 flex flex-col items-end">
               <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                 {formatCurrency(valor)}
               </span>
            </div>
          </div>

          {/* Body: Solução/Detalhes */}
          {(opportunity.solucao || opportunity.nome_contato) && (
             <div className="text-xs text-slate-400 line-clamp-2 bg-white/5 p-2 rounded-lg border border-white/5">
                {opportunity.solucao && <div className="font-medium text-slate-300 mb-1">{opportunity.solucao}</div>}
                {contatoLabel && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <User size={10} />
                    {contatoLabel}
                  </div>
                )}
             </div>
          )}

          {/* Footer: Data e Responsável */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
             <div className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Data de inclusão">
                <Calendar size={12} />
                <span>{formatDate(opportunity.data_inclusao)}</span>
             </div>

             <div className="flex items-center gap-2">
                {/* Temperatura/Prioridade (Visual) */}
                {opportunity.temperatura !== null && opportunity.temperatura > 0 && (
                  <div className="flex gap-0.5" title={`Temperatura: ${opportunity.temperatura}%`}>
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`w-1 h-3 rounded-full ${i * 33 <= (opportunity.temperatura || 0) ? 'bg-amber-500' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                )}
                
                {/* Avatar do Vendedor */}
                {opportunity.id_vendedor ? (
                   <div className="w-5 h-5 rounded-full bg-cyan-900/50 border border-cyan-500/30 flex items-center justify-center text-[8px] font-bold text-cyan-200" title={opportunity.vendedor}>
                      {String(opportunity.id_vendedor).substring(0, 2).toUpperCase()}
                   </div>
                ) : (
                   <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500">
                      ?
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}

export default function OportunidadesKanban() {
  const [opportunities, setOpportunities] = useState<CRM_Oportunidade[]>([])
  const [stages, setStages] = useState<Stage[]>(FALLBACK_STAGES)
  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [produtos, setProdutos] = useState<CRM_Produto[]>([])
  const [servicos, setServicos] = useState<CRM_Servico[]>([])
  const [motivos, setMotivos] = useState<CRM_Motivo[]>([])
  const [origens, setOrigens] = useState<CRM_OrigemLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [draftCod, setDraftCod] = useState('')
  const [draftClienteId, setDraftClienteId] = useState('')
  const [draftContatoId, setDraftContatoId] = useState('')
  const [draftFaseId, setDraftFaseId] = useState('')
  const [draftStatusId, setDraftStatusId] = useState('')
  const [draftMotivoId, setDraftMotivoId] = useState('')
  const [draftOrigemId, setDraftOrigemId] = useState('')
  const [draftSolucao, setDraftSolucao] = useState<'PRODUTO' | 'SERVICO'>('PRODUTO')
  const [draftTicket, setDraftTicket] = useState('')
  const [draftTemperatura, setDraftTemperatura] = useState('50')
  const [draftQtd, setDraftQtd] = useState('1')
  const [draftPrevEntrega, setDraftPrevEntrega] = useState('')
  const [draftProdutoId, setDraftProdutoId] = useState('')
  const [draftServicoId, setDraftServicoId] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [draftDescricao, setDraftDescricao] = useState('')

  const active = useMemo(() => opportunities.find(o => (o.id_oport || (o as any).id_oportunidade) === activeId) || null, [opportunities, activeId])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [data, fases, sts] = await Promise.all([fetchOportunidades({ orderDesc: true }), fetchCrmFases(), fetchCrmStatus()])
      setOpportunities(data)
      setStatuses(sts)

      const mapped = (fases || [])
        .map((e) => ({
          id: e.fase_id,
          label: (e.fase_desc || '').trim(),
          ordem: Number(e.fase_ordem ?? 0),
          cor: e.fase_cor || null
        }))
        .filter((s) => Boolean(s.id) && Boolean(s.label))

      const unique = new Map<string, Stage>()
      for (const s of mapped) {
        if (!unique.has(s.id)) unique.set(s.id, s)
      }

      const stageList = Array.from(unique.values()).sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))

      setStages(stageList.length > 0 ? stageList : FALLBACK_STAGES)
    } catch (error) {
      console.error('Failed to load opportunities', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!formOpen) return
    setFormError(null)
    if (active) {
      setDraftCod(active.cod_oport || active.cod_oportunidade || '')
      setDraftClienteId(active.id_cliente || '')
      setDraftContatoId(active.id_contato || '')
      setDraftFaseId(active.id_fase || '')
      setDraftStatusId(active.id_status || '')
      setDraftMotivoId(active.id_motivo || '')
      setDraftOrigemId(active.id_origem || '')
      setDraftSolucao((active.solucao as any) || 'PRODUTO')
      setDraftTicket(active.ticket_valor === null || active.ticket_valor === undefined ? '' : String(active.ticket_valor))
      setDraftTemperatura(active.temperatura === null || active.temperatura === undefined ? '50' : String(active.temperatura))
      setDraftQtd(active.qts_item === null || active.qts_item === undefined ? '1' : String(active.qts_item))
      setDraftPrevEntrega(active.prev_entrega ? String(active.prev_entrega).slice(0, 7) : '')
      setDraftProdutoId(active.cod_produto || '')
      setDraftServicoId(active.cod_servico || '')
      setDraftObs(active.obs_oport || '')
      setDraftDescricao(active.descricao_oport || '')
    } else {
      setDraftCod('')
      setDraftClienteId('')
      setDraftContatoId('')
      setDraftFaseId(stages[0]?.id || '')
      setDraftStatusId('')
      setDraftMotivoId('')
      setDraftOrigemId('')
      setDraftSolucao('PRODUTO')
      setDraftTicket('')
      setDraftTemperatura('50')
      setDraftQtd('1')
      setDraftPrevEntrega('')
      setDraftProdutoId('')
      setDraftServicoId('')
      setDraftObs('')
      setDraftDescricao('')
    }
  }, [formOpen, active, stages])

  useEffect(() => {
    if (!formOpen) return
    Promise.all([fetchCrmProdutos(), fetchCrmServicos(), fetchCrmMotivos(), fetchCrmOrigensLead()])
      .then(([p, s, m, o]) => {
        setProdutos(p)
        setServicos(s)
        setMotivos(m)
        setOrigens(o)
      })
      .catch(() => {
        setProdutos([])
        setServicos([])
        setMotivos([])
        setOrigens([])
      })
  }, [formOpen])

  const openCreate = () => {
    setActiveId(null)
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    setActiveId(id)
    setFormOpen(true)
  }

  const parseMoney = (input: string) => {
    const raw = (input || '').trim()
    if (!raw) return null
    const cleaned = raw.replace(/[^\d,.-]/g, '')
    if (!cleaned) return null
    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')
    let normalized = cleaned
    if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.')
    else normalized = cleaned.replace(',', '.')
    const v = Number.parseFloat(normalized)
    return Number.isFinite(v) ? v : null
  }

  const handleSave = async () => {
    const cod = draftCod.trim() || null
    const ticket = parseMoney(draftTicket)
    const temp = Number.parseInt(draftTemperatura, 10)
    const temperatura = Number.isFinite(temp) ? Math.min(100, Math.max(1, temp)) : null
    const qtdParsed = Number.parseInt(draftQtd, 10)
    const qts_item = Number.isFinite(qtdParsed) ? Math.max(0, qtdParsed) : null
    const prev_entrega = draftPrevEntrega ? `${draftPrevEntrega}-01` : null
    const faseLabel = stages.find(s => s.id === draftFaseId)?.label || null

    const payload: any = {
      cod_oport: cod,
      id_cliente: draftClienteId.trim() || null,
      id_contato: draftContatoId.trim() || null,
      id_fase: draftFaseId || null,
      id_status: draftStatusId || null,
      id_motivo: draftMotivoId || null,
      id_origem: draftOrigemId || null,
      solucao: draftSolucao,
      qts_item,
      prev_entrega,
      cod_produto: draftSolucao === 'PRODUTO' ? (draftProdutoId || null) : null,
      cod_servico: draftSolucao === 'SERVICO' ? (draftServicoId || null) : null,
      ticket_valor: ticket,
      temperatura,
      obs_oport: draftObs.trim() || null,
      descricao_oport: draftDescricao.trim() || null,
      fase: faseLabel
    }

    setSaving(true)
    setFormError(null)
    try {
      if (activeId) {
        await updateOportunidade(activeId, payload)
      } else {
        await createOportunidade(payload)
      }
      setFormOpen(false)
      setActiveId(null)
      await loadData()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStageId = destination.droppableId
    const faseLabel = stages.find(s => s.id === newStageId)?.label || null
    
    // 1. Optimistic Update
    const originalOpportunities = [...opportunities]
    setOpportunities(prev => prev.map(op => {
      const id = (op.id_oport || (op as any).id_oportunidade)
      if (id === draggableId) {
        return { ...op, id_fase: newStageId, fase: faseLabel }
      }
      return op
    }))

    // 2. API Call
    try {
       await updateOportunidade(draggableId, { id_fase: newStageId, fase: faseLabel } as any)
    } catch (error) {
       console.error('Failed to update stage', error)
       // Rollback
       setOpportunities(originalOpportunities)
       alert('Falha ao atualizar a fase da oportunidade.')
    }
  }, [opportunities, stages])

  // Filtragem
  const filteredOpportunities = opportunities.filter(op => {
    const term = search.toLowerCase()
    return (
      (op.cliente?.toLowerCase().includes(term) || false) ||
      (op.solucao?.toLowerCase().includes(term) || false) ||
      (op.vendedor?.toLowerCase().includes(term) || false)
    )
  })

  // Agrupamento por etapa
  const stageIds = new Set(stages.map((s) => s.id))
  const defaultStageId = stages[0]?.id || FALLBACK_STAGES[0]!.id

  const columns = stages
    .slice()
    .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
    .map(stage => {
    return {
      ...stage,
      items: filteredOpportunities.filter(op => {
        // Normalização simples para garantir match
        const rawStageId = (op.id_fase || '').trim()
        if (rawStageId && stageIds.has(rawStageId)) return rawStageId === stage.id

        const label = (op.fase || '').trim()
        if (label) {
          const match = stages.find(s => s.label === label)
          if (match) return match.id === stage.id
        }

        return stage.id === defaultStageId
      })
    }
  })

  // Cálculos de totais
  const totalValue = filteredOpportunities.reduce((acc, curr) => acc + (Number(curr.valor_proposta) || 0), 0)
  const totalCount = filteredOpportunities.length

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4 animate-in fade-in duration-500">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Pipeline de Vendas</h1>
            <p className="text-xs text-slate-400">Gerencie suas oportunidades e negociações</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total em Pipeline</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalValue)}</span>
           </div>
           <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oportunidades</span>
              <span className="text-sm font-bold text-slate-200">{totalCount}</span>
           </div>

           <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar oportunidades..."
                className="pl-10 pr-4 py-2 rounded-xl bg-[#0F172A] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 w-48 transition-all"
              />
           </div>

           <button
             type="button"
             onClick={openCreate}
             className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
           >
             <Plus size={16} />
             NOVA OPORTUNIDADE
           </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        {loading && opportunities.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-2xl border border-white/5 bg-[#0F172A]">
            <div className="flex items-center gap-3 text-slate-300">
              <Loader2 className="animate-spin text-cyan-400" size={18} />
              <span className="text-sm font-semibold">Carregando oportunidades...</span>
            </div>
          </div>
        ) : (
          <HorizontalScrollArea className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex h-full gap-4 min-w-[1400px] px-1">
              {columns.map(column => (
                <div key={column.id} className="flex flex-col w-80 shrink-0 h-full">
                  <div
                    className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-b-2 bg-[#0F172A] border-white/5"
                    style={{
                      borderBottomColor: column.cor ? hexToRgba(column.cor, 0.55) : undefined,
                      backgroundColor: column.cor ? hexToRgba(column.cor, 0.08) : undefined
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-black uppercase tracking-wider"
                        style={{ color: column.cor || undefined }}
                      >
                        {column.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">
                      {column.items.length}
                    </span>
                  </div>

                  <div
                    className="flex-1 rounded-xl bg-slate-900/20 border border-white/5 p-2 transition-colors"
                    style={{ backgroundColor: column.cor ? hexToRgba(column.cor, 0.05) : undefined }}
                  >
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`h-full overflow-y-auto custom-scrollbar pr-1 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5 rounded-lg' : ''}`}
                        >
                          {column.items.map((item, index) => (
                            <OpportunityCard
                              key={item.id_oport || (item as any).id_oportunidade}
                              opportunity={item}
                              index={index}
                              onOpen={openEdit}
                            />
                          ))}
                          {provided.placeholder}

                          {column.items.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-24 opacity-30">
                              <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center mb-2">
                                <Plus size={14} className="text-slate-500" />
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">Arraste ou crie aqui</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>

                  <div className="mt-2 px-2 flex justify-between items-center opacity-60">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Total</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatCurrency(column.items.reduce((acc, i) => acc + (Number(i.valor_proposta) || 0), 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </HorizontalScrollArea>
        )}
      </DragDropContext>

      <Modal
        isOpen={formOpen}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          setActiveId(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <LayoutDashboard size={16} className="text-cyan-300" />
            </div>
            {activeId ? 'Editar Oportunidade' : 'Nova Oportunidade'}
          </div>
        }
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                if (saving) return
                setFormOpen(false)
                setActiveId(null)
              }}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
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
          {formError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Código</label>
              <input
                value={draftCod}
                onChange={e => setDraftCod(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500"
                placeholder="Ex: OP-2026-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Solução</label>
              <select
                value={draftSolucao}
                onChange={e => setDraftSolucao(e.target.value as any)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="PRODUTO">Venda de Produto</option>
                <option value="SERVICO">Venda de Serviço</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Fase</label>
              <select
                value={draftFaseId}
                onChange={e => setDraftFaseId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {stages
                  .slice()
                  .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Status</label>
              <select
                value={draftStatusId}
                onChange={e => setDraftStatusId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {statuses.map(s => (
                  <option key={s.status_id} value={s.status_id}>
                    {s.status_desc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Motivo</label>
              <select
                value={draftMotivoId}
                onChange={e => setDraftMotivoId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {motivos.map(m => (
                  <option key={m.motiv_id} value={m.motiv_id}>
                    {m.descricao_motiv}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Origem</label>
              <select
                value={draftOrigemId}
                onChange={e => setDraftOrigemId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {origens.map(o => (
                  <option key={o.orig_id} value={o.orig_id}>
                    {o.descricao_orig}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Ticket (R$)</label>
              <input
                value={draftTicket}
                onChange={e => setDraftTicket(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500 font-mono"
                placeholder="Ex: 1500,00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Temperatura (1-100)</label>
              <input
                value={draftTemperatura}
                onChange={e => setDraftTemperatura(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500 font-mono"
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Qtd. Itens</label>
              <input
                value={draftQtd}
                onChange={e => setDraftQtd(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500 font-mono"
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Prev. Entrega (mês/ano)</label>
              <input
                type="month"
                value={draftPrevEntrega}
                onChange={e => setDraftPrevEntrega(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              />
            </div>
          </div>

          {draftSolucao === 'PRODUTO' ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Produto</label>
              <select
                value={draftProdutoId}
                onChange={e => setDraftProdutoId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {produtos.map(p => (
                  <option key={p.prod_id} value={p.prod_id}>
                    {p.descricao_prod}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Serviço</label>
              <select
                value={draftServicoId}
                onChange={e => setDraftServicoId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {servicos.map(s => (
                  <option key={s.serv_id} value={s.serv_id}>
                    {s.descricao_serv}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cliente (ID)</label>
              <input
                value={draftClienteId}
                onChange={e => setDraftClienteId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500 font-mono"
                placeholder="UUID do cliente"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Contato (ID)</label>
              <input
                value={draftContatoId}
                onChange={e => setDraftContatoId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none placeholder:text-slate-500 font-mono"
                placeholder="UUID do contato"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observação</label>
            <textarea
              value={draftObs}
              onChange={e => setDraftObs(e.target.value)}
              className="w-full h-24 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
              placeholder="Notas rápidas..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Descrição</label>
            <textarea
              value={draftDescricao}
              onChange={e => setDraftDescricao(e.target.value)}
              className="w-full h-28 rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
              placeholder="Detalhes da oportunidade..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
