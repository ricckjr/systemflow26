import { useCallback, useEffect, useState } from 'react'
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
import { CRM_Oportunidade, fetchOportunidades, updateOportunidade } from '@/services/crm'
import { HorizontalScrollArea } from '@/components/ui'

// Configuração das Etapas (Colunas)
const STAGES = [
  { id: 'Lead', label: 'Lead', color: 'text-slate-400', border: 'border-slate-500/50', bg: 'bg-slate-500/10' },
  { id: 'Prospecção', label: 'Prospecção', color: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/10' },
  { id: 'Apresentação', label: 'Apresentação', color: 'text-indigo-400', border: 'border-indigo-500/50', bg: 'bg-indigo-500/10' },
  { id: 'Qualificação', label: 'Qualificação', color: 'text-purple-400', border: 'border-purple-500/50', bg: 'bg-purple-500/10' },
  { id: 'Negociação', label: 'Negociação', color: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/10' },
  { id: 'Conquistado', label: 'Conquistado', color: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10' },
  { id: 'Perdidos', label: 'Perdidos', color: 'text-rose-400', border: 'border-rose-500/50', bg: 'bg-rose-500/10' },
  { id: 'Pós-Venda', label: 'Pós-Venda', color: 'text-cyan-400', border: 'border-cyan-500/50', bg: 'bg-cyan-500/10' },
]

const formatCurrency = (value: string | number | null) => {
  if (!value) return 'R$ 0,00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR')
}

// Componente do Cartão de Oportunidade
const OpportunityCard = ({ opportunity, index }: { opportunity: CRM_Oportunidade; index: number }) => {
  return (
    <Draggable draggableId={opportunity.id_oportunidade} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            group relative flex flex-col gap-3 p-4 mb-3 rounded-xl border transition-all duration-200
            ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500 rotate-2 scale-105 z-50 bg-[#1E293B]' : 'bg-[#0F172A] border-white/5 shadow-sm hover:shadow-md hover:border-white/10'}
          `}
        >
          {/* Header: Cliente e Valor */}
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-100 truncate" title={opportunity.cliente || 'Sem cliente'}>
                {opportunity.cliente || 'Novo Cliente'}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={10} className="text-slate-500" />
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {opportunity.empresa_correspondente || 'Empresa não inf.'}
                </span>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end">
               <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                 {formatCurrency(opportunity.valor_proposta)}
               </span>
            </div>
          </div>

          {/* Body: Solução/Detalhes */}
          {(opportunity.solucao || opportunity.nome_contato) && (
             <div className="text-xs text-slate-400 line-clamp-2 bg-white/5 p-2 rounded-lg border border-white/5">
                {opportunity.solucao && <div className="font-medium text-slate-300 mb-1">{opportunity.solucao}</div>}
                {opportunity.nome_contato && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <User size={10} />
                    {opportunity.nome_contato}
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
                {opportunity.vendedor ? (
                   <div className="w-5 h-5 rounded-full bg-cyan-900/50 border border-cyan-500/30 flex items-center justify-center text-[8px] font-bold text-cyan-200" title={opportunity.vendedor}>
                      {opportunity.vendedor.substring(0, 2).toUpperCase()}
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchOportunidades({ orderDesc: true })
      setOpportunities(data)
    } catch (error) {
      console.error('Failed to load opportunities', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStage = destination.droppableId
    
    // 1. Optimistic Update
    const originalOpportunities = [...opportunities]
    setOpportunities(prev => prev.map(op => {
      if (op.id_oportunidade === draggableId) {
        return { ...op, etapa: newStage }
      }
      return op
    }))

    // 2. API Call
    try {
       await updateOportunidade(draggableId, { etapa: newStage })
    } catch (error) {
       console.error('Failed to update stage', error)
       // Rollback
       setOpportunities(originalOpportunities)
       alert('Falha ao atualizar a etapa da oportunidade.')
    }
  }, [opportunities])

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
  const columns = STAGES.map(stage => {
    return {
      ...stage,
      items: filteredOpportunities.filter(op => {
        // Normalização simples para garantir match
        const opStage = (op.etapa || 'Lead').trim()
        return opStage === stage.id
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

           <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95">
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
                    className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-b-2 bg-[#0F172A] border-white/5 ${column.border.replace('border-', 'border-b-')}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${column.color}`}>{column.label}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">
                      {column.items.length}
                    </span>
                  </div>

                  <div className={`flex-1 rounded-xl bg-slate-900/20 border border-white/5 p-2 transition-colors ${column.bg}`}>
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`h-full overflow-y-auto custom-scrollbar pr-1 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5 rounded-lg' : ''}`}
                        >
                          {column.items.map((item, index) => (
                            <OpportunityCard key={item.id_oportunidade} opportunity={item} index={index} />
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
    </div>
  )
}
