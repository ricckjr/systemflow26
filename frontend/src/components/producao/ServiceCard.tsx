import React from 'react'
import { ServicEquipamento } from '@/types/domain'
import { Draggable } from '@hello-pangea/dnd'

interface ServiceCardProps {
  service: ServicEquipamento
  index: number
  onClick: (service: ServicEquipamento) => void
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, index, onClick }) => {
  return (
    <Draggable draggableId={service.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(service)}
          className="p-3 mb-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow cursor-pointer active:cursor-grabbing group"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border)]">
              {service.id_rst || '...'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
                {new Date(service.updated_at).toLocaleDateString()}
            </span>
          </div>
          
          <h4 className="text-sm font-semibold text-[var(--text-main)] mb-1 truncate" title={service.modelo || ''}>
            {service.modelo || 'Modelo não inf.'}
          </h4>
          
          <p className="text-xs text-[var(--text-soft)] mb-2 truncate" title={service.cliente}>
            {service.cliente}
          </p>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
             <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[100px]" title={service.numero_serie || ''}>
               SN: {service.numero_serie || '-'}
             </span>
             {service.garantia && (
                 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                     GARANTIA
                 </span>
             )}
          </div>
        </div>
      )}
    </Draggable>
  )
}
