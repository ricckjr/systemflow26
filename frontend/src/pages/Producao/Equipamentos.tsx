import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calendar, Download, ExternalLink, FileText, Hash, History, Image as ImageIcon, Loader2, RefreshCw, Search, Tag, User, Wrench, X, Layers } from 'lucide-react'
import { useServicsEquipamento } from '@/hooks/useServicsEquipamento'
import type { ServicEquipamento } from '@/types/domain'
import { Modal } from '@/components/ui'
import { formatDateBR, formatDateTimeBR } from '@/utils/datetime'
import { getOsPhaseConfig } from '@/config/ordemServicoKanbanConfig'
import { getServicHistorico } from '@/services/servicsEquipamento'
import { CRM_Oportunidade, CRM_Status, fetchCrmStatus, fetchOportunidadeByCodigoProposta } from '@/services/crm'

const normalizeText = (v: string) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const Equipamentos: React.FC = () => {
  const { services, loading, error, refresh } = useServicsEquipamento()
  const [search, setSearch] = useState('')
  const [faseFilter, setFaseFilter] = useState<string>('ALL')
  const [selected, setSelected] = useState<ServicEquipamento | null>(null)
  const [proposta, setProposta] = useState<CRM_Oportunidade | null>(null)
  const [loadingProposta, setLoadingProposta] = useState(false)
  const [propostaError, setPropostaError] = useState<string | null>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [crmStatuses, setCrmStatuses] = useState<CRM_Status[]>([])
  const [loadingCrmStatuses, setLoadingCrmStatuses] = useState(false)

  useEffect(() => {
    const cod = String(selected?.cod_proposta || '').trim()
    if (!selected || !cod) {
      setProposta(null)
      setPropostaError(null)
      return
    }

    let alive = true
    setLoadingProposta(true)
    setPropostaError(null)
    void (async () => {
      try {
        const data = await fetchOportunidadeByCodigoProposta(cod)
        if (!alive) return
        setProposta(data)
      } catch (e: any) {
        if (!alive) return
        setProposta(null)
        setPropostaError(String(e?.message || 'Erro ao carregar dados da proposta.'))
      } finally {
        if (!alive) return
        setLoadingProposta(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [selected?.cod_proposta])

  useEffect(() => {
    const id = String(selected?.id || '').trim()
    if (!selected || !id) {
      setHistorico([])
      return
    }
    let alive = true
    setLoadingHistorico(true)
    void (async () => {
      try {
        const rows = await getServicHistorico(id)
        if (!alive) return
        setHistorico(Array.isArray(rows) ? rows : [])
      } catch {
        if (!alive) return
        setHistorico([])
      } finally {
        if (!alive) return
        setLoadingHistorico(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return
    let alive = true
    setLoadingCrmStatuses(true)
    void (async () => {
      try {
        const sts = await fetchCrmStatus()
        if (!alive) return
        setCrmStatuses(Array.isArray(sts) ? sts : [])
      } catch {
        if (!alive) return
        setCrmStatuses([])
      } finally {
        if (!alive) return
        setLoadingCrmStatuses(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [selected?.id])

  const crmStatusById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of crmStatuses || []) {
      const id = String((s as any)?.status_id || '').trim()
      const desc = String((s as any)?.status_desc || '').trim()
      if (id && desc) out[id] = desc
    }
    return out
  }, [crmStatuses])

  const faseOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of services || []) {
      const f = String(s?.fase || '').trim()
      if (f) set.add(f)
    }
    return Array.from(set)
      .sort((a, b) => getOsPhaseConfig(a).label.localeCompare(getOsPhaseConfig(b).label, 'pt-BR'))
      .map((fase) => ({ fase, label: getOsPhaseConfig(fase).label }))
  }, [services])

  const filtered = useMemo(() => {
    const term = normalizeText(search)
    const list = (services || []).filter((s) => {
      if (faseFilter === 'ALL') return true
      return String(s?.fase || '').trim() === faseFilter
    })

    if (!term) return list
    return list.filter((s) => {
      const hay = normalizeText(
        `${s.id_rst || ''} ${s.cod_proposta || ''} ${s.cliente || ''} ${s.modelo || ''} ${s.fabricante || ''} ${s.tag || ''} ${s.numero_serie || ''} ${(s as any).numero_serie2 || ''}`
      )
      return hay.includes(term)
    })
  }, [faseFilter, search, services])

  const openDetails = (s: ServicEquipamento) => {
    setSelected(s)
    setPreviewImageUrl(null)
  }

  return (
    <div className="pt-4 pb-0 px-4 md:px-6 flex flex-col h-[calc(100vh-64px)] min-h-0 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <Wrench size={14} />
        Equipamentos
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por RST, proposta, cliente, modelo, TAG ou série..."
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
          <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Fase</div>
          <div className="mt-2 flex items-center gap-3">
            <select
              value={faseFilter}
              onChange={(e) => setFaseFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
            >
              <option value="ALL">Todas</option>
              {faseOptions.map((o) => (
                <option key={o.fase} value={o.fase}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-muted)] flex items-center justify-between">
        <span>Total</span>
        <span className="font-bold text-[var(--text-main)]">{filtered.length}</span>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[var(--bg-main)] text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider border-b border-[var(--border)] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">ID RST</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Saída</th>
              <th className="px-4 py-3">Fase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-main)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <div className="flex items-center justify-center text-[var(--text-muted)] gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Carregando...
                  </div>
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="text-sm hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
                  onClick={() => openDetails(s)}
                >
                  <td className="px-4 py-3 font-bold text-[var(--text-main)]">{s.id_rst || 'Gerando...'}</td>
                  <td className="px-4 py-3 text-[var(--text-soft)]">{s.cliente || '-'}</td>
                  <td className="px-4 py-3 text-[var(--text-soft)]">{s.modelo || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--text-muted)]">{formatDateBR(s.data_entrada || s.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--text-muted)]">{s.data_finalizada ? formatDateBR(s.data_finalizada) : '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-main)] uppercase">
                      {getOsPhaseConfig(s.fase).label}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => {
          setSelected(null)
          setPreviewImageUrl(null)
        }}
        size="4xl"
        title={
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <Wrench size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Detalhes do Equipamento</div>
                <div className="text-lg font-black text-[var(--text-main)] truncate">{selected?.id_rst || '...'}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {selected?.cod_proposta ? `Proposta ${selected.cod_proposta}` : 'Proposta —'} • {selected?.cliente || 'Cliente —'}
                </div>
              </div>
            </div>
            {selected?.fase ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-xl border bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-main)] uppercase whitespace-nowrap">
                  {getOsPhaseConfig(selected.fase).label}
                </span>
                {loadingCrmStatuses || loadingProposta ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl border bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-muted)] uppercase whitespace-nowrap">
                    Status CRM...
                  </span>
                ) : proposta?.id_status && crmStatusById[String((proposta as any).id_status || '').trim()] ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl border bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-main)] uppercase whitespace-nowrap">
                    {crmStatusById[String((proposta as any).id_status || '').trim()]}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        }
        footer={
          selected ? (
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setPreviewImageUrl(null)
                }}
                className="h-10 px-5 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2"
              >
                <X size={16} />
                Fechar
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-5">
                <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Resumo</div>
                <div className="mt-3 space-y-2">
                  <Kv label="ID RST" value={selected.id_rst || '—'} />
                  <Kv label="Código da Proposta" value={selected.cod_proposta || '—'} />
                  <Kv label="Cliente" value={selected.cliente || '—'} />
                  <Kv label="Etapa Funil" value={selected.etapa_omie || '—'} />
                  <Kv label="CNPJ" value={selected.cnpj || '—'} />
                  <Kv label="Entrada" value={formatDateTimeBR(selected.data_entrada || selected.created_at)} />
                  <Kv label="Atualizado" value={formatDateTimeBR(selected.updated_at)} />
                </div>
              </div>

              <div className="lg:col-span-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  <Tag size={14} />
                  Dados do Equipamento
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Pill label="Modelo" value={selected.modelo} />
                  <Pill label="Fabricante" value={selected.fabricante} />
                  <Pill label="TAG" value={selected.tag} />
                  <Pill label="Faixa" value={selected.faixa} />
                  <Pill label="Nº Série 1" value={selected.numero_serie} />
                  <Pill label="Nº Série 2" value={String((selected as any)?.numero_serie2 || '').trim() || null} />
                  <Pill label="Nº NF" value={selected.numero_nf} />
                  <Pill label="Nº Pedido" value={selected.numero_pedido} />
                  <Pill label="Garantia" value={selected.garantia ? 'Sim' : 'Não'} />
                  <Pill label="Nº Certificado" value={selected.numero_certificado} />
                  <Pill label="Data calibração" value={selected.data_calibracao ? formatDateBR(selected.data_calibracao) : null} />
                  <Pill label="Responsável" value={selected.responsavel} />
                </div>
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Endereço</div>
                  <div className="mt-2 text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">
                    {selected.endereco || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-5">
                <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Solicitação do Cliente</div>
                <div className="mt-3 text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">
                  {String((selected as any)?.solicitacao_cliente || '').trim() || '—'}
                </div>
              </div>
              <div className="lg:col-span-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-5">
                <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Análise Visual / Observações Iniciais</div>
                <div className="mt-3 text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">
                  {String((selected as any)?.observacoes_equipamento || '').trim() || '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <Layers size={14} />
                  Campos Técnicos
                </div>
                <div className="mt-3 space-y-3">
                  <ReadOnlyBlock title="Testes Realizados" value={String((selected as any)?.testes_realizados || '').trim()} />
                  <ReadOnlyBlock title="Serviços a Serem Executados" value={String((selected as any)?.servicos_a_fazer || '').trim()} />
                  <ReadOnlyBlock title="Relatório Técnico" value={String((selected as any)?.relatorio_tecnico || '').trim()} />
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <ImageIcon size={14} />
                  Galeria de Imagens
                </div>
                <div className="mt-3">
                  {Array.isArray(selected.imagens) && selected.imagens.filter(Boolean).length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {selected.imagens.filter(Boolean).map((url, i) => (
                        <div key={`${url}-${i}`} className="group relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)]">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(url)}
                            className="absolute inset-0"
                            title="Visualizar"
                          />
                          <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/45">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-black/30 text-white hover:bg-black/40"
                              title="Abrir em nova aba"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} />
                            </a>
                            <a
                              href={url}
                              download
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-black/30 text-white hover:bg-black/40"
                              title="Baixar"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">Nenhuma imagem anexada.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <User size={14} />
                  Vendedor
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Nome</span>
                    <span className="text-[var(--text-main)] font-medium text-right">{selected.vendedor || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">E-mail</span>
                    <span className="text-[var(--text-main)] font-medium text-right">{selected.email_vendedor || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Empresa</span>
                    <span className="text-[var(--text-main)] font-medium text-right">{selected.empresa_correspondente || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <FileText size={14} />
                  Documentos Complementares
                </div>
                <div className="mt-3">
                  <DocumentsBlock anexos={(selected as any)?.anexos ?? null} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <History size={14} />
                  Históricos de Andamento
                </div>
                {loadingHistorico ? (
                  <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Loader2 className="animate-spin" size={14} />
                    Carregando...
                  </div>
                ) : null}
              </div>
              <div className="mt-3">
                {historico.length ? (
                  <div className="space-y-3">
                    {historico.map((h, idx) => (
                      <div key={String(h?.id || idx)} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[var(--text-main)]">
                              {String(h?.fase_origem || '-').trim() || '-'} → {String(h?.fase_destino || '-').trim() || '-'}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {formatDateTimeBR(String(h?.data_movimentacao || h?.created_at || ''))}
                            </div>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] text-right">
                            {String(h?.profiles?.nome || '').trim() || '—'}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2">
                            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Responsável</div>
                            <div className="mt-1 text-[var(--text-main)]">{String(h?.responsavel_destino || h?.responsavel_origem || '-').trim() || '-'}</div>
                          </div>
                          <div className="lg:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2">
                            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Descrição</div>
                            <div className="mt-1 text-[var(--text-main)] whitespace-pre-wrap break-words">
                              {String(h?.descricao || h?.servicos_realizados || h?.observacoes || '-').trim() || '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">Nenhum histórico encontrado.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Dados da Proposta</div>
                {loadingProposta ? (
                  <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Loader2 className="animate-spin" size={14} />
                    Carregando...
                  </div>
                ) : null}
              </div>
              {propostaError ? (
                <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {propostaError}
                </div>
              ) : null}
              <div className="mt-3">
                {proposta ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        <Hash size={14} />
                        Proposta
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Código</span>
                          <span className="text-[var(--text-main)] font-medium">{String((proposta as any).cod_oport || (proposta as any).cod_oportunidade || selected.cod_proposta || '-')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Solução</span>
                          <span className="text-[var(--text-main)] font-medium">{String((proposta as any).solucao || selected.solucao || '-')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Status</span>
                          <span className="text-[var(--text-main)] font-medium">
                            {crmStatusById[String((proposta as any).id_status || '').trim()] || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        <User size={14} />
                        Cliente / Vendedor
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Cliente</span>
                          <span className="text-[var(--text-main)] font-medium text-right">{String((proposta as any).cliente_nome || (proposta as any).cliente || selected.cliente || '-')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Vendedor</span>
                          <span className="text-[var(--text-main)] font-medium text-right">{String((proposta as any).vendedor_nome || (proposta as any).vendedor || selected.vendedor || '-')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--text-muted)]">Empresa</span>
                          <span className="text-[var(--text-main)] font-medium text-right">{String((proposta as any).empresa_correspondente || selected.empresa_correspondente || '-')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        <FileText size={14} />
                        Descrição
                      </div>
                      <div className="mt-3 text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">
                        {String((proposta as any).descricao_oport || (proposta as any).descricao_oportunidade || '-').trim() || '-'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">Nenhum dado de proposta encontrado para este código.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        size="4xl"
        title="Visualizar imagem"
        footer={
          previewImageUrl ? (
            <div className="flex items-center justify-end gap-3 w-full">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-4 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2"
              >
                <ExternalLink size={16} />
                Abrir
              </a>
              <a
                href={previewImageUrl}
                download
                className="h-10 px-4 rounded-xl bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                <Download size={16} />
                Baixar
              </a>
            </div>
          ) : null
        }
      >
        {previewImageUrl ? (
          <div className="w-full flex items-center justify-center">
            <img src={previewImageUrl} alt="preview" className="max-h-[70vh] w-auto object-contain rounded-xl border border-[var(--border)] bg-[var(--bg-main)]" />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default Equipamentos

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] pt-0.5">{label}</div>
      <div className="text-sm font-medium text-[var(--text-main)] text-right whitespace-pre-wrap break-words">{value || '—'}</div>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string | null | undefined }) {
  const v = String(value ?? '').trim()
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[var(--text-main)] truncate">{v || '—'}</div>
    </div>
  )
}

function ReadOnlyBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</div>
      <div className="mt-2 text-sm text-[var(--text-main)] whitespace-pre-wrap break-words">{value || '-'}</div>
    </div>
  )
}

function DocumentsBlock({ anexos }: { anexos: unknown }) {
  const list = Array.isArray(anexos) ? anexos : []
  const items = list
    .map((x: any) => ({
      name: String(x?.name || x?.nome || '').trim(),
      url: String(x?.url || x?.publicUrl || x?.link || '').trim(),
      mimeType: String(x?.mimeType || x?.mime_type || '').trim(),
      size: typeof x?.size === 'number' ? x.size : null,
      uploadedAt: String(x?.uploaded_at || x?.created_at || '').trim()
    }))
    .filter((x) => x.url.length > 0)

  if (!items.length) {
    return <div className="text-sm text-[var(--text-muted)]">Nenhum documento anexado.</div>
  }

  return (
    <div className="space-y-2">
      {items.map((a, idx) => (
        <div key={`${a.url}-${idx}`} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-main)] truncate">{a.name || 'Documento'}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {a.mimeType || 'arquivo'}{a.uploadedAt ? ` • ${formatDateTimeBR(a.uploadedAt)}` : ''}{typeof a.size === 'number' ? ` • ${Math.round(a.size / 1024)} KB` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors inline-flex items-center gap-2"
              title="Visualizar"
            >
              <ExternalLink size={14} />
              Ver
            </a>
            <a
              href={a.url}
              download
              className="h-9 px-3 rounded-xl bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all inline-flex items-center gap-2"
              title="Baixar"
            >
              <Download size={14} />
              Baixar
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
