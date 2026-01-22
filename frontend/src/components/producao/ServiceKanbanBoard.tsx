import React from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { ServicEquipamento } from '@/types/domain'
import { ETAPAS_SERVICOS } from '@/services/servicsEquipamento'
import { ServiceCard } from './ServiceCard'
import { Loader2 } from 'lucide-react'
import { HorizontalScrollArea } from '@/components/ui'

interface ServiceKanbanBoardProps {
  services: ServicEquipamento[]
  loading: boolean
  onDragEnd: (result: DropResult) => void
  onCardClick: (service: ServicEquipamento) => void
}

export const ServiceKanbanBoard: React.FC<ServiceKanbanBoardProps> = ({ services, loading, onDragEnd, onCardClick }) => {
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
        {ETAPAS_SERVICOS.map((status) => (
          <div key={status} className="flex-shrink-0 w-[calc(100vw-2rem)] sm:w-80 flex flex-col h-full min-h-0 max-h-full snap-start">
            <div className="flex items-center justify-between mb-3 px-1 shrink-0">
              <h3 className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wider">
                {status}
              </h3>
              <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-panel)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                {getServicesByStatus(status).length}
              </span>
            </div>

            <div className="flex-1 min-h-0 bg-[var(--bg-body)]/50 rounded-2xl border border-[var(--border)] p-2">
                <Droppable droppableId={status}>
                {(provided) => (
                    <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="h-full min-h-[150px] overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar pr-1"
                    >
                    {getServicesByStatus(status).map((service, index) => (
                        <ServiceCard key={service.id} service={service} index={index} onClick={onCardClick} />
                    ))}
                    {provided.placeholder}
                    </div>
                )}
                </Droppable>
            </div>
          </div>
        ))}
      </HorizontalScrollArea>
    </DragDropContext>
  )
}
