import React, { useEffect, useMemo, useState } from 'react'
import { useProposalServices } from '@/hooks/useServicsEquipamento'
import { Calendar, Hash, Image as ImageIcon, Loader2, Mail, Pencil, Save, Tag, User, Wrench, X } from 'lucide-react'
import { Modal } from '@/components/ui'
import type { ServicEquipamento } from '@/types/domain'
import { updateServicEquipamentoDetalhes } from '@/services/servicsEquipamento'
import { getOsPhaseConfig } from '@/config/ordemServicoKanbanConfig'

interface EquipmentListProps {
    codProposta: string
    lastUpdate?: number
}

export const EquipmentList: React.FC<EquipmentListProps> = ({ codProposta, lastUpdate }) => {
    const { services, loading, refresh } = useProposalServices(codProposta)
    const [selected, setSelected] = useState<ServicEquipamento | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [draft, setDraft] = useState({
        modelo: '',
        fabricante: '',
        numero_serie: '',
        numero_serie2: '',
        tag: '',
        faixa: '',
        garantia: false,
        numero_nf: '',
        numero_pedido: '',
        numero_certificado: '',
        data_calibracao: '',
        observacoes_equipamento: '',
        responsavel: ''
    })

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
    const inputBase =
        'w-full h-9 px-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors'
    const textareaBase =
        'w-full p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors resize-none'

    const openDetails = (service: ServicEquipamento) => {
        setSelected(service)
        setIsEditing(false)
        setDraft({
            modelo: service.modelo || '',
            fabricante: service.fabricante || '',
            numero_serie: service.numero_serie || '',
            numero_serie2: (service as any).numero_serie2 || '',
            tag: service.tag || '',
            faixa: service.faixa || '',
            garantia: !!service.garantia,
            numero_nf: service.numero_nf || '',
            numero_pedido: service.numero_pedido || '',
            numero_certificado: service.numero_certificado || '',
            data_calibracao: service.data_calibracao ? new Date(service.data_calibracao).toISOString().split('T')[0] : '',
            observacoes_equipamento: service.observacoes_equipamento || '',
            responsavel: service.responsavel || ''
        })
    }

    const openEdit = (service: ServicEquipamento) => {
        openDetails(service)
        setIsEditing(true)
    }

    const toNull = (v: string) => (v.trim().length ? v : null)

    const handleSave = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const updated = await updateServicEquipamentoDetalhes(selected.id, {
                modelo: toNull(draft.modelo),
                fabricante: toNull(draft.fabricante),
                numero_serie: toNull(draft.numero_serie),
                numero_serie2: toNull(draft.numero_serie2),
                tag: toNull(draft.tag),
                faixa: toNull(draft.faixa),
                garantia: !!draft.garantia,
                numero_nf: toNull(draft.numero_nf),
                numero_pedido: toNull(draft.numero_pedido),
                numero_certificado: toNull(draft.numero_certificado),
                data_calibracao: draft.data_calibracao.trim().length ? draft.data_calibracao : null,
                observacoes_equipamento: toNull(draft.observacoes_equipamento),
                responsavel: toNull(draft.responsavel)
            })
            setSelected(updated)
            setIsEditing(false)
            await refresh()
        } finally {
            setSaving(false)
        }
    }

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
                        <th className="px-2 py-2 w-[44px]"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-main)]">
                    {services.map((service) => (
                        <tr
                            key={service.id}
                            className="text-sm hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
                            onClick={() => openDetails(service)}
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
                                    {getOsPhaseConfig(service.fase).label}
                                </span>
                            </td>
                            <td className="px-2 py-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        openEdit(service)
                                    }}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--primary)]/30 transition-colors"
                                    title="Editar equipamento"
                                >
                                    <Pencil size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>

            <Modal
                isOpen={!!selected}
                onClose={() => {
                    setSelected(null)
                    setIsEditing(false)
                }}
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
                                {getOsPhaseConfig(selected.fase).label}
                            </span>
                        )}
                    </div>
                }
                footer={
                    selected ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="text-xs text-[var(--text-muted)]">
                                {isEditing ? 'Modo edição' : 'Visualização'}
                            </div>
                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openDetails(selected)}
                                            disabled={saving}
                                            className="h-10 px-4 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                                        >
                                            <X size={16} />
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="h-10 px-6 rounded-xl bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                            Salvar
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="h-10 px-4 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2"
                                    >
                                        <Pencil size={16} />
                                        Editar
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null
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
                                        <span className="text-[var(--text-main)] font-medium">{selected.fase ? getOsPhaseConfig(selected.fase).label : 'NÃO INFORMADO'}</span>
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
                                        {isEditing ? (
                                            <input value={draft.modelo} onChange={(e) => setDraft((p) => ({ ...p, modelo: e.target.value }))} className={inputBase} placeholder="Modelo" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.modelo || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Fabricante</div>
                                        {isEditing ? (
                                            <input value={draft.fabricante} onChange={(e) => setDraft((p) => ({ ...p, fabricante: e.target.value }))} className={inputBase} placeholder="Fabricante" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.fabricante || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Série 1</div>
                                        {isEditing ? (
                                            <input value={draft.numero_serie} onChange={(e) => setDraft((p) => ({ ...p, numero_serie: e.target.value }))} className={inputBase} placeholder="Nº Série 1" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.numero_serie || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Série 2</div>
                                        {isEditing ? (
                                            <input value={draft.numero_serie2} onChange={(e) => setDraft((p) => ({ ...p, numero_serie2: e.target.value }))} className={inputBase} placeholder="Nº Série 2" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{(selected as any).numero_serie2 || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">TAG</div>
                                        {isEditing ? (
                                            <input value={draft.tag} onChange={(e) => setDraft((p) => ({ ...p, tag: e.target.value }))} className={inputBase} placeholder="TAG" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.tag || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Faixa</div>
                                        {isEditing ? (
                                            <input value={draft.faixa} onChange={(e) => setDraft((p) => ({ ...p, faixa: e.target.value }))} className={inputBase} placeholder="Faixa" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.faixa || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Garantia</div>
                                        {isEditing ? (
                                            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)]">
                                                <input
                                                    type="checkbox"
                                                    checked={draft.garantia}
                                                    onChange={(e) => setDraft((p) => ({ ...p, garantia: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-main)] text-[var(--primary)] focus:ring-[var(--primary)]/30"
                                                />
                                                <span className="text-sm font-semibold text-[var(--text-main)]">Garantia</span>
                                            </label>
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.garantia ? 'SIM' : 'NÃO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Responsável</div>
                                        {isEditing ? (
                                            <input value={draft.responsavel} onChange={(e) => setDraft((p) => ({ ...p, responsavel: e.target.value }))} className={inputBase} placeholder="Responsável" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.responsavel || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Documento / Calibração</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">NF</div>
                                        {isEditing ? (
                                            <input value={draft.numero_nf} onChange={(e) => setDraft((p) => ({ ...p, numero_nf: e.target.value }))} className={inputBase} placeholder="NF" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.numero_nf || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Pedido</div>
                                        {isEditing ? (
                                            <input value={draft.numero_pedido} onChange={(e) => setDraft((p) => ({ ...p, numero_pedido: e.target.value }))} className={inputBase} placeholder="Pedido" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.numero_pedido || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Nº Certificado</div>
                                        {isEditing ? (
                                            <input value={draft.numero_certificado} onChange={(e) => setDraft((p) => ({ ...p, numero_certificado: e.target.value }))} className={inputBase} placeholder="Nº Certificado" />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.numero_certificado || 'NÃO INFORMADO'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Data Calibração</div>
                                        {isEditing ? (
                                            <input type="date" value={draft.data_calibracao} onChange={(e) => setDraft((p) => ({ ...p, data_calibracao: e.target.value }))} className={inputBase} />
                                        ) : (
                                            <div className="text-[var(--text-main)] font-semibold">{selected.data_calibracao ? new Date(selected.data_calibracao).toLocaleDateString() : 'NÃO INFORMADO'}</div>
                                        )}
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
                                        {isEditing ? (
                                            <textarea
                                                value={draft.observacoes_equipamento}
                                                onChange={(e) => setDraft((p) => ({ ...p, observacoes_equipamento: e.target.value }))}
                                                rows={5}
                                                className={textareaBase}
                                                placeholder="Observações"
                                            />
                                        ) : (
                                            <div className="text-[var(--text-main)] whitespace-pre-wrap">{selected.observacoes_equipamento || 'NÃO INFORMADO'}</div>
                                        )}
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
