import React, { useEffect } from 'react'
import { useProposalServices } from '@/hooks/useServicsEquipamento'
import { Loader2, Wrench } from 'lucide-react'

interface EquipmentListProps {
    codProposta: string
    lastUpdate?: number
}

export const EquipmentList: React.FC<EquipmentListProps> = ({ codProposta, lastUpdate }) => {
    const { services, loading, refresh } = useProposalServices(codProposta)

    useEffect(() => {
        refresh()
    }, [lastUpdate, refresh])

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-cyan-500" />
            </div>
        )
    }

    if (!services || services.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-main)]">
                <Wrench size={24} className="mb-2 opacity-50" />
                <span className="text-sm">Nenhum equipamento registrado para esta proposta.</span>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--border)]">
                    <tr>
                        <th className="px-4 py-2">ID RST</th>
                        <th className="px-4 py-2">Modelo</th>
                        <th className="px-4 py-2">Entrada</th>
                        <th className="px-4 py-2">Fase</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-main)]">
                    {services.map((service) => (
                        <tr key={service.id} className="text-sm hover:bg-[var(--bg-panel)] transition-colors">
                            <td className="px-4 py-2 font-bold text-[var(--text-main)]">{service.id_rst || 'Gerando...'}</td>
                            <td className="px-4 py-2 text-[var(--text-soft)]">{service.modelo || '-'}</td>
                            <td className="px-4 py-2">
                                <span className="text-xs text-[var(--text-muted)]">
                                    {new Date(service.data_entrada || service.created_at).toLocaleDateString()}
                                </span>
                            </td>
                            <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-main)] uppercase">
                                    {service.fase}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
