import React from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { ServicEquipamento } from '@/types/domain'
import { ETAPAS_SERVICOS } from '@/services/servicsEquipamento'
import { getOsPhaseConfig } from '@/config/ordemServicoKanbanConfig'
import { ServiceCard } from './ServiceCard'
import { Loader2 } from 'lucide-react'
import { HorizontalScrollArea } from '@/components/ui'
import { UsuarioSimples } from '@/hooks/useUsuarios'

interface ServiceKanbanBoardProps {
  services: ServicEquipamento[]
  loading: boolean
  usuarios?: UsuarioSimples[]
  onDragEnd: (result: DropResult) => void
  onCardClick: (service: ServicEquipamento) => void
}

export const ServiceKanbanBoard: React.FC<ServiceKanbanBoardProps> = ({ services, loading, usuarios = [], onDragEnd, onCardClick }) => {
  const getServicesByStatus = (status: string) => {
    return services.filter(s => s.fase === status)
  }

  if (loading && services.length === 0) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-[var(--text-muted)]" size={32} />
          </div>
      )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <HorizontalScrollArea className="flex h-full min-h-0 w-full max-w-full gap-4 overflow-x-scroll overflow-y-hidden pb-3 items-start overscroll-contain snap-x snap-mandatory md:snap-none">
        {ETAPAS_SERVICOS.map((status) => {
          const config = getOsPhaseConfig(status)
          const items = getServicesByStatus(status)
          
          return (
          <div key={status} className="flex-shrink-0 w-[calc(100vw-2rem)] sm:w-80 flex flex-col h-full min-h-0 max-h-full snap-start">
            <div className="flex items-center justify-between mb-3 px-1 shrink-0">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                 <h3 className={`text-xs font-bold uppercase tracking-wider ${config.color} opacity-90`}>
                   {config.label}
                 </h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${config.bg} ${config.border} ${config.color}`}>
                {items.length}
              </span>
            </div>

            <div className={`flex-1 min-h-0 rounded-2xl border bg-[var(--bg-body)]/50 ${config.border} p-2 transition-colors`}>
                <Droppable droppableId={status}>
                {(provided, snapshot) => (
                    <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`h-full min-h-[150px] overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar pr-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? config.bg : ''}`}
                    >
                    {items.map((service, index) => {
                        const responsavelUser = usuarios.find(u => u.nome === service.responsavel)
                        return (
                            <ServiceCard 
                                key={service.id} 
                                service={service} 
                                index={index} 
                                onClick={onCardClick}
                                responsavelAvatar={responsavelUser?.avatar_url}
                            />
                        )
                    })}
                    {provided.placeholder}
                    </div>
                )}
                </Droppable>
            </div>
          </div>
        )})}
      </HorizontalScrollArea>
    </DragDropContext>
  )
}
