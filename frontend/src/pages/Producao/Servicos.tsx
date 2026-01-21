import React, { useState } from 'react'
import { RefreshCw, Tag, User, Calendar, MapPin, Building2, Layers, AlertCircle, Wrench, Package } from 'lucide-react'
import { useServicsEquipamento } from '@/hooks/useServicsEquipamento'
import { ServiceKanbanBoard } from '@/components/producao/ServiceKanbanBoard'
import { DropResult } from '@hello-pangea/dnd'
import { Modal } from '@/components/ui/Modal'
import { ServicEquipamento } from '@/types/domain'

const Servicos: React.FC = () => {
  const { services, loading, refresh, moveService, error } = useServicsEquipamento()
  const [selectedService, setSelectedService] = useState<ServicEquipamento | null>(null)

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result
    if (!destination) return
    if (destination.droppableId === result.source.droppableId && destination.index === result.source.index) return

    moveService(draggableId, destination.droppableId)
  }

  const daysInProduction = (date: string) => {
    return Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="h-[calc(100vh-80px)] pt-4 pb-6 max-w-[1800px] mx-auto px-4 md:px-6 flex flex-col">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 shrink-0">
        <h2 className="text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
          Produção / Serviços
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="h-9 px-4 rounded-xl bg-white/5 border border-[var(--border)] text-sm text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-white/10 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <ServiceKanbanBoard 
            services={services} 
            loading={loading} 
            onDragEnd={onDragEnd}
            onCardClick={setSelectedService}
        />
      </div>

      {/* Detalhes do Serviço Modal */}
      <Modal
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        title={
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Wrench size={18} />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Ficha de Serviço</span>
                <span className="text-lg font-bold text-[var(--text-main)]">{selectedService?.id_rst || '...'}</span>
             </div>
          </div>
        }
        size="3xl"
      >
        {selectedService && (
            <div className="space-y-6">
                {/* Header Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Cliente</label>
                        <div className="text-lg font-semibold text-[var(--text-main)] mb-1">{selectedService.cliente}</div>
                        {selectedService.cnpj && (
                            <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
                                <Building2 size={12} />
                                {selectedService.cnpj}
                            </div>
                        )}
                        {selectedService.endereco && (
                            <div className="flex items-center gap-2 text-xs text-[var(--text-soft)] mt-1">
                                <MapPin size={12} />
                                {selectedService.endereco}
                            </div>
                        )}
                        {selectedService.solucao && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Solução</label>
                                <p className="text-xs text-[var(--text-main)] line-clamp-2">{selectedService.solucao}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] flex flex-col justify-between">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Proposta</label>
                                <div className="text-base font-bold text-cyan-400">{selectedService.cod_proposta}</div>
                            </div>
                            {selectedService.etapa_omie && (
                                <div className="mt-2">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Etapa Omie</label>
                                    <div className="text-xs font-medium px-2 py-1 rounded bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] inline-block">
                                        {selectedService.etapa_omie}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)]">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">Dias em Prod.</label>
                            <div className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                                <Calendar size={16} className="text-[var(--text-muted)]" />
                                {daysInProduction(selectedService.data_entrada)} dias
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Modelo</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate" title={selectedService.modelo || ''}>{selectedService.modelo || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Fabricante</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate" title={selectedService.fabricante || ''}>{selectedService.fabricante || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Nº Série</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate" title={selectedService.numero_serie || ''}>{selectedService.numero_serie || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">TAG</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate" title={selectedService.tag || ''}>{selectedService.tag || '-'}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">NF</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.numero_nf || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Pedido</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.numero_pedido || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Faixa</label>
                        <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.faixa || '-'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Garantia</label>
                        <div className={`text-sm font-bold ${selectedService.garantia ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                            {selectedService.garantia ? 'SIM' : 'NÃO'}
                        </div>
                    </div>
                </div>

                {/* Observações */}
                <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block flex items-center gap-2">
                        <AlertCircle size={14} />
                        Análise Visual / Observações
                    </label>
                    <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
                        {selectedService.observacoes_equipamento || 'Nenhuma observação registrada.'}
                    </p>
                </div>

                {/* Imagens */}
                {selectedService.imagens && selectedService.imagens.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase flex items-center gap-2">
                            <Tag size={14} />
                            Imagens Anexadas
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {selectedService.imagens.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg overflow-hidden border border-[var(--border)] hover:ring-2 hover:ring-[var(--primary)] transition-all">
                                    <img src={url} alt={`Anexo ${i}`} className="w-full h-full object-cover" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Footer Meta */}
                <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1"><Calendar size={12}/> Entrada: {new Date(selectedService.data_entrada).toLocaleDateString()}</span>
                            {selectedService.data_finalizada && (
                                <span className="text-emerald-400 font-medium">Finalizado: {new Date(selectedService.data_finalizada).toLocaleDateString()}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--bg-body)] border border-[var(--border)]">
                                Fase Prod: {selectedService.fase}
                             </span>
                        </div>
                     </div>
                     
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span>Criado: {new Date(selectedService.created_at).toLocaleString()}</span>
                            <span>Atualizado: {new Date(selectedService.updated_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={12} />
                            Responsável: <span className="text-[var(--text-main)] font-medium">{selectedService.responsavel || 'Não atribuído'}</span>
                        </div>
                     </div>
                </div>
            </div>
        )}
      </Modal>
    </div>
  )
}

export default Servicos
