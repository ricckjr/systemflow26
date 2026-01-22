import React, { useEffect, useMemo, useState } from 'react'
import { useProposalServices } from '@/hooks/useServicsEquipamento'
import { Calendar, Hash, Image as ImageIcon, Loader2, Mail, Tag, User, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui'
import type { ServicEquipamento } from '@/types/domain'

interface EquipmentListProps {
    codProposta: string
    lastUpdate?: number
}

export const EquipmentList: React.FC<EquipmentListProps> = ({ codProposta, lastUpdate }) => {
    const { services, loading, refresh } = useProposalServices(codProposta)
    const [selected, setSelected] = useState<ServicEquipamento | null>(null)

    useEffect(() => {
        refresh()
    }, [lastUpdate, refresh])

    const selectedImagens = useMemo(() => {
        const imgs = selected?.imagens
        return Array.isArray(imgs) ? imgs.filter(Boolean) : []
    }, [selected?.imagens])

    const selectedAnexos = useMemo(() => {
        const raw = (selected as any)?.anexos
        if (!raw) return null
        return raw
    }, [selected])

    const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString() : 'NÃO INFORMADO')

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
        <>
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
                        <tr
                            key={service.id}
                            className="text-sm hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
                            onClick={() => setSelected(service)}
                        >
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

            <Modal
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                size="4xl"
                title={
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                                <Wrench size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Equipamento em Produção</div>
                                <div className="text-lg font-bold text-[var(--text-main)] truncate">{selected?.id_rst || '...'}</div>
                                <div className="text-xs text-[var(--text-muted)] truncate">{selected?.cliente || 'NÃO INFORMADO'}</div>
                            </div>
                        </div>
                        {selected?.fase && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-main)] uppercase whitespace-nowrap">
                                {selected.fase}
                            </span>
                        )}
                    </div>
                }
            >
                        {selected && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Identificação</div>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">ID RST</span>
                                        <span className="text-[var(--text-main)] font-medium">{selected.id_rst || 'NÃO INFORMADO'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Proposta</span>
                                        <span className="text-[var(--text-main)] font-medium">{selected.cod_proposta || 'NÃO INFORMADO'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Etapa Omie</span>
                                        <span className="text-[var(--text-main)] font-medium">{selected.etapa_omie || 'NÃO INFORMADO'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Fase</span>
                                        <span className="text-[var(--text-main)] font-medium">{selected.fase || 'NÃO INFORMADO'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Vendedor</div>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)] flex items-center gap-2"><User size={14} /> Nome</span>
                                        <span className="text-[var(--text-main)] font-medium">{(selected as any).vendedor || 'NÃO INFORMADO'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)] flex items-center gap-2"><Mail size={14} /> Email</span>
                                        <span className="text-[var(--text-main)] font-medium truncate">{(selected as any).email_vendedor || 'NÃO INFORMADO'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Empresa</span>
                                        <span className="text-[var(--text-main)] font-medium truncate">{(selected as any).empresa_correspondente || 'NÃO INFORMADO'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Datas</div>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)] flex items-center gap-2"><Calendar size={14} /> Entrada</span>
                                        <span className="text-[var(--text-main)] font-medium">{fmtDate(selected.data_entrada)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Finalizada</span>
                                        <span className="text-[var(--text-main)] font-medium">{fmtDate(selected.data_finalizada)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Criado</span>
                                        <span className="text-[var(--text-main)] font-medium">{fmtDate(selected.created_at)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[var(--text-muted)]">Atualizado</span>
                                        <span className="text-[var(--text-main)] font-medium">{fmtDate(selected.updated_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Equipamento</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Modelo</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.modelo || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fabricante</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.fabricante || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Série 1</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.numero_serie || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Série 2</div>
                                        <div className="text-[var(--text-main)] font-semibold">{(selected as any).numero_serie2 || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">TAG</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.tag || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Faixa</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.faixa || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Garantia</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.garantia ? 'SIM' : 'NÃO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Responsável</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.responsavel || 'NÃO INFORMADO'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Documento / Calibração</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">NF</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.numero_nf || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Pedido</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.numero_pedido || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Certificado</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.numero_certificado || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Data Calibração</div>
                                        <div className="text-[var(--text-main)] font-semibold">{selected.data_calibracao ? new Date(selected.data_calibracao).toLocaleDateString() : 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Solução</div>
                                        <div className="text-[var(--text-main)] font-semibold whitespace-pre-wrap">{selected.solucao || 'NÃO INFORMADO'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Técnico</div>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Observações do equipamento</div>
                                        <div className="text-[var(--text-main)] whitespace-pre-wrap">{selected.observacoes_equipamento || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Testes realizados</div>
                                        <div className="text-[var(--text-main)] whitespace-pre-wrap">{selected.testes_realizados || 'NÃO INFORMADO'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Serviços a fazer</div>
                                        <div className="text-[var(--text-main)] whitespace-pre-wrap">{selected.servicos_a_fazer || 'NÃO INFORMADO'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Anexos</div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] uppercase">
                                        <ImageIcon size={14} />
                                        Imagens ({selectedImagens.length})
                                    </div>
                                    {selectedImagens.length ? (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                            {selectedImagens.map((url, i) => (
                                                <a
                                                    key={`${url}-${i}`}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]"
                                                    title="Abrir imagem"
                                                >
                                                    <img src={url} alt={`Imagem ${i}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-[var(--text-muted)]">Nenhuma imagem.</div>
                                    )}

                                    <div className="pt-3 border-t border-[var(--border)]">
                                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] uppercase">
                                            <Tag size={14} />
                                            Anexos
                                        </div>
                                        {selectedAnexos ? (
                                            <pre className="mt-2 text-xs text-[var(--text-soft)] whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] p-3">
                                                {JSON.stringify(selectedAnexos, null, 2)}
                                            </pre>
                                        ) : (
                                            <div className="mt-2 text-sm text-[var(--text-muted)]">Nenhum anexo.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    )
}
