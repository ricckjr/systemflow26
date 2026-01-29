import React from 'react'
import { ServicEquipamento } from '@/types/domain'
import { Draggable } from '@hello-pangea/dnd'
import { User, Wrench, Clock, Hourglass, Hash } from 'lucide-react'
import { formatDuration, getStatusDurationColor } from '@/utils/time'

interface ServiceCardProps {
  service: ServicEquipamento
  index: number
  onClick: (service: ServicEquipamento) => void
  isTvMode?: boolean
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, index, onClick, isTvMode = false }) => {
  if (isTvMode) {
    return (
      <Draggable draggableId={service.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onClick(service)}
            data-kanban-card="true"
            className={`
              group relative flex flex-col gap-2 p-3 mb-2 rounded-xl border transition-all duration-200
              ${snapshot.isDragging ? 'shadow-xl ring-2 ring-[var(--primary)] rotate-2 scale-105 z-50' : 'shadow-sm hover:shadow-md hover:border-[var(--primary)]/50'}
              bg-[var(--bg-panel)] border-[var(--border)] ring-1 ring-white/5 hover:ring-white/10
            `}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-[var(--primary)] px-2 py-1 rounded-md border border-[var(--primary)]/40 shadow-sm shadow-[var(--primary)]/20">
                    <Hash size={10} className="text-white/80" />
                    <span className="text-xs font-black tracking-wide text-white">{service.cod_proposta}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-[var(--text-muted)] font-mono bg-[var(--bg-main)]/50 px-1.5 py-0.5 rounded-md border border-[var(--border)]">
                   <span>SN:</span>
                   <span className="text-[var(--text-main)]">{service.numero_serie || '-'}</span>
                </div>
             </div>

             <div className="flex flex-col gap-1">
                <h4 className="text-xs font-bold text-[var(--text-main)] leading-tight line-clamp-2" title={service.modelo || ''}>
                    {service.modelo || 'Modelo não informado'}
                </h4>
             </div>

             {service.solucao && (
                <div className="p-1.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]/50">
                    <p className="text-[9px] text-[var(--text-soft)] line-clamp-2 leading-relaxed italic">
                        "{service.solucao}"
                    </p>
                </div>
             )}

             <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border)] mt-auto">
                <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--text-muted)]">Total:</span>
                    <span className="font-medium text-[var(--text-main)]">{formatDuration(service.data_entrada)}</span>
                </div>
                {service.data_fase_atual && (
                    <div className="flex items-center justify-between text-[9px]">
                        <span className="text-[var(--text-muted)]">Fase:</span>
                        <span className={`font-bold ${getStatusDurationColor(service.data_fase_atual)}`}>
                            {formatDuration(service.data_fase_atual)}
                        </span>
                    </div>
                )}
             </div>
          </div>
        )}
      </Draggable>
    )
  }

  return (
    <Draggable draggableId={service.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(service)}
          data-kanban-card="true"
          className={`
            group relative flex flex-col gap-3 p-4 mb-3 rounded-2xl border transition-all duration-200
            ${snapshot.isDragging ? 'shadow-xl ring-2 ring-[var(--primary)] rotate-2 scale-105 z-50' : 'shadow-sm hover:shadow-md hover:border-[var(--primary)]/50'}
            bg-[var(--bg-panel)] border-[var(--border)] ring-1 ring-white/5 hover:ring-white/10
          `}
        >
            {/* Header: ID e Proposta */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-md bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border)]">
                    {service.id_rst || 'N/A'}
                </span>
                <div className="flex items-center gap-2 text-sm font-black text-white bg-[var(--primary)] px-3 py-1.5 rounded-lg border border-[var(--primary)]/40 shadow-md shadow-[var(--primary)]/25">
                    <Hash size={14} className="text-white/85" />
                    <span className="tracking-wide">{service.cod_proposta}</span>
                </div>
            </div>

            {/* Body: Modelo e SN */}
            <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-[var(--text-main)] leading-tight line-clamp-2" title={service.modelo || ''}>
                    {service.modelo || 'Modelo não informado'}
                </h4>
                <div className="flex items-center gap-2">
                     <span className="text-[10px] text-[var(--text-soft)] font-mono" title="Número de Série">
                        SN: {service.numero_serie || '-'}
                     </span>
                </div>
            </div>

            {/* Solução (Se houver) */}
            {service.solucao && (
                <div className="p-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]/50">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Wrench size={10} className="text-[var(--text-muted)]" />
                        <span className="text-[9px] font-bold uppercase text-[var(--text-muted)] tracking-wider">Solução</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-soft)] line-clamp-2 leading-relaxed">
                        {service.solucao}
                    </p>
                </div>
            )}

            {/* Footer: Times e Responsável */}
            <div className="flex items-end justify-between pt-2 border-t border-[var(--border)] mt-auto">
                {/* Times (Left) */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]" title="Tempo total na oficina">
                        <Clock size={12} className="text-[var(--text-soft)]" />
                        <span className="font-medium">Total: {formatDuration(service.data_entrada)}</span>
                    </div>
                    {service.data_fase_atual && (
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${getStatusDurationColor(service.data_fase_atual)}`} title="Tempo nesta etapa">
                            <Hourglass size={12} />
                            <span>Fase: {formatDuration(service.data_fase_atual)}</span>
                        </div>
                    )}
                </div>

                {/* Avatar & Badges (Right) */}
                <div className="flex items-center gap-2">
                     {service.garantia && (
                        <div className="mr-2" title="Em Garantia">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                     )}
                     
                     {service.responsavel ? (
                        <div
                          className="max-w-[160px] px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-[10px] font-black tracking-wide truncate"
                          title={`Responsável: ${service.responsavel}`}
                        >
                          {service.responsavel}
                        </div>
                     ) : (
                        <div className="w-7 h-7 rounded-full ring-2 ring-[var(--bg-panel)] bg-[var(--bg-main)] border border-dashed border-[var(--border)] flex items-center justify-center" title="Sem responsável">
                            <User size={12} className="text-[var(--text-muted)] opacity-50" />
                        </div>
                     )}
                </div>
            </div>
        </div>
      )}
    </Draggable>
  )
}
