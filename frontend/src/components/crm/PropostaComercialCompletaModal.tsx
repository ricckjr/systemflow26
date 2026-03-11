import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Calendar, FileText, Loader2, MessageSquareText, Truck, UserRound, Wrench } from 'lucide-react'
import { Modal, HorizontalScrollArea } from '@/components/ui'
import { EquipmentEntryModal } from '@/components/producao/EquipmentEntryModal'
import { EquipmentList } from '@/components/producao/EquipmentList'
import type { UsuarioSimples } from '@/hooks/useUsuarios'
import { supabase } from '@/services/supabase'
import {
  CRM_Fase,
  CRM_Oportunidade,
  CRM_OportunidadeAtividade,
  CRM_OportunidadeComentario,
  CRM_Status,
  createOportunidadeComentario,
  fetchCrmFases,
  fetchCrmStatus,
  fetchOportunidadeById,
  fetchOportunidadeAtividades,
  fetchOportunidadeComentarios,
} from '@/services/crm'

type TabId = 'geral' | 'logistica' | 'atividades' | 'comentarios'

const normalizeText = (v: string) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const formatDateTimeBR = (dateString?: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR', { hour12: false })
}

const formatDateBR = (dateString?: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('pt-BR')
}

const getCodProposta = (o: CRM_Oportunidade) => String((o as any).cod_oport ?? (o as any).cod_oportunidade ?? '').trim()
const getCliente = (o: CRM_Oportunidade) => String((o as any).cliente_nome ?? (o as any).cliente ?? '').trim()
const getDescricao = (o: CRM_Oportunidade) => String((o as any).descricao_oport ?? (o as any).descricao_oportunidade ?? '').trim()
const getFaseLabel = (o: CRM_Oportunidade) =>
  String((o as any)?.fase || (o as any)?.fase_desc || (o as any)?.etapa || (o as any)?.etapa_desc || '').trim() || '-'
const getStatusLabel = (o: CRM_Oportunidade) =>
  String((o as any)?.status || (o as any)?.status_desc || (o as any)?.status_label || '').trim() || String((o as any)?.id_status || '').trim() || '-'
const getFaseId = (o: CRM_Oportunidade) => String((o as any)?.id_fase || (o as any)?.fase_id || '').trim()
const getStatusId = (o: CRM_Oportunidade) => String((o as any)?.id_status || (o as any)?.status_id || '').trim()

export function PropostaComercialCompletaModal(props: {
  isOpen: boolean
  oportunidadeId: string | null
  usuarios?: UsuarioSimples[]
  onClose: () => void
}) {
  const { isOpen, oportunidadeId, usuarios, onClose } = props
  const [tab, setTab] = useState<TabId>('geral')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [equipmentEntryOpen, setEquipmentEntryOpen] = useState(false)
  const [equipmentLastUpdate, setEquipmentLastUpdate] = useState(0)
  const [faseOptions, setFaseOptions] = useState<CRM_Fase[]>([])
  const [statusOptions, setStatusOptions] = useState<CRM_Status[]>([])

  const [active, setActive] = useState<CRM_Oportunidade | null>(null)
  const [atividades, setAtividades] = useState<CRM_OportunidadeAtividade[]>([])
  const [comentarios, setComentarios] = useState<CRM_OportunidadeComentario[]>([])
  const [comentarioTexto, setComentarioTexto] = useState('')
  const [comentarioSaving, setComentarioSaving] = useState(false)
  const bucketDocsComplementares = 'crm-propostas-comerciais-docs'
  const bucketPedidoCompra = 'crm-pedidos-compra'
  const [docsComplementares, setDocsComplementares] = useState<
    Array<{ name: string; path: string; createdAt: string | null; updatedAt: string | null; size: number | null; mimeType: string | null }>
  >([])
  const [docsComplementaresLoading, setDocsComplementaresLoading] = useState(false)

  const equipmentInitialData = useMemo(() => {
    const cod = active ? getCodProposta(active) : ''
    const cliente = active ? getCliente(active) : ''
    const cnpj = active ? String((active as any)?.cliente_documento || (active as any)?.cnpj || '').trim() : ''
    const solucao = active ? String((active as any)?.solucao || '').trim() : ''
    return {
      cod_proposta: cod,
      cliente: cliente,
      cnpj: cnpj,
      solucao: solucao
    } as any
  }, [active])

  const canOpenEquipmentEntry = useMemo(() => {
    if (!isOpen) return false
    const id = String(oportunidadeId || '').trim()
    if (!id) return false
    const cod = String((equipmentInitialData as any)?.cod_proposta || '').trim()
    return !!cod && !loading
  }, [equipmentInitialData, isOpen, loading, oportunidadeId])

  useEffect(() => {
    if (!isOpen) return
    const id = String(oportunidadeId || '').trim()
    if (!id) return
    let cancelled = false
    setTab('geral')
    setLoading(true)
    setError(null)
    setActive(null)
    setAtividades([])
    setComentarios([])
    setComentarioTexto('')
    setFaseOptions([])
    setStatusOptions([])
    setDocsComplementares([])

    ;(async () => {
      try {
        const [fetched, fases, statuses, acts, comms] = await Promise.all([
          fetchOportunidadeById(id),
          fetchCrmFases(),
          fetchCrmStatus(),
          fetchOportunidadeAtividades(id).catch(() => [] as any[]),
          fetchOportunidadeComentarios(id).catch(() => [] as any[])
        ])
        if (cancelled) return
        setActive(fetched)
        setFaseOptions(Array.isArray(fases) ? (fases as CRM_Fase[]) : [])
        setStatusOptions(Array.isArray(statuses) ? (statuses as CRM_Status[]) : [])
        setAtividades(Array.isArray(acts) ? (acts as any) : [])
        setComentarios(Array.isArray(comms) ? (comms as any) : [])

        setDocsComplementaresLoading(true)
        try {
          const dir = `${bucketDocsComplementares}/${id}`
          const r = await supabase.storage.from(bucketDocsComplementares).list(dir, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
          } as any)
          if (cancelled) return
          if (r.error) throw r.error
          const rows = (r.data || []).map((o: any) => {
            const name = String(o?.name || '').trim()
            const meta = (o?.metadata || {}) as any
            return {
              name: name || '-',
              path: `${dir}/${name}`,
              createdAt: o?.created_at ? String(o.created_at) : null,
              updatedAt: o?.updated_at ? String(o.updated_at) : null,
              size: typeof meta?.size === 'number' ? meta.size : null,
              mimeType: typeof meta?.mimetype === 'string' ? meta.mimetype : null
            }
          })
          setDocsComplementares(rows)
        } catch {
          if (!cancelled) setDocsComplementares([])
        } finally {
          if (!cancelled) setDocsComplementaresLoading(false)
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Falha ao carregar a proposta.'
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, oportunidadeId])

  const faseLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of faseOptions || []) {
      const id = String((f as any)?.fase_id || '').trim()
      if (!id) continue
      const label = String((f as any)?.fase_desc || '').trim()
      if (!label) continue
      out[id] = label
    }
    return out
  }, [faseOptions])

  const statusLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of statusOptions || []) {
      const id = String((s as any)?.status_id || '').trim()
      if (!id) continue
      const label = String((s as any)?.status_desc || '').trim()
      if (!label) continue
      out[id] = label
    }
    return out
  }, [statusOptions])

  const usuarioById = useMemo(() => {
    const out: Record<string, UsuarioSimples> = {}
    for (const u of usuarios || []) {
      const id = String(u?.id || '').trim()
      if (!id) continue
      out[id] = u
    }
    return out
  }, [usuarios])

  const [statusHistoryUserById, setStatusHistoryUserById] = useState<Record<string, string>>({})

  useEffect(() => {
    const base: Record<string, string> = {}
    for (const u of usuarios || []) {
      const id = String(u?.id || '').trim()
      if (!id) continue
      base[id] = String(u?.nome || u?.email_corporativo || u?.email_login || '').trim() || id
    }
    setStatusHistoryUserById((prev) => ({ ...base, ...prev }))
  }, [usuarios])

  useEffect(() => {
    if (!isOpen) return
    const ids = Array.from(
      new Set(
        [
          ...atividades.map((a: any) => String(a?.created_by || '').trim()),
          ...comentarios.map((c: any) => String(c?.created_by || '').trim())
        ]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )
    ) as string[]
    const missing = ids.filter((id) => !statusHistoryUserById[id])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('id, nome, email_login, email_corporativo')
          .in('id', missing)
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data || []) as any[]) {
          const id = String(r?.id || '').trim()
          if (!id) continue
          map[id] = String(r?.nome || r?.email_corporativo || r?.email_login || id).trim()
        }
        setStatusHistoryUserById((prev) => ({ ...prev, ...map }))
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [atividades, comentarios, isOpen, statusHistoryUserById])

  const vendedorInfo = useMemo(() => {
    if (!active) return null
    const vendedorId = String((active as any)?.id_vendedor || '').trim()
    if (!vendedorId) return null
    return usuarioById[vendedorId] || null
  }, [active, usuarioById])

  const dataInclusaoRaw = useMemo(() => {
    if (!active) return null
    return (
      String((active as any)?.criado_em || (active as any)?.data_inclusao || (active as any)?.created_at || '').trim() || null
    )
  }, [active])

  const ultimaMovRaw = useMemo(() => {
    if (!active) return null
    return (
      String((active as any)?.data_alteracao || (active as any)?.atualizado_em || (active as any)?.updated_at || '').trim() || null
    )
  }, [active])

  const tempoAbertoLabel = useMemo(() => {
    if (!dataInclusaoRaw) return '-'
    const start = new Date(dataInclusaoRaw)
    if (Number.isNaN(start.getTime())) return '-'
    const ms = Date.now() - start.getTime()
    if (!Number.isFinite(ms) || ms < 0) return '-'
    const totalMinutes = Math.floor(ms / (60 * 1000))
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
    return `${days}d ${hours}h`
  }, [dataInclusaoRaw])

  const diasSemMov = useMemo(() => {
    const baseRaw = ultimaMovRaw || dataInclusaoRaw
    if (!baseRaw) return null
    const dt = new Date(baseRaw)
    if (Number.isNaN(dt.getTime())) return null
    const ms = Date.now() - dt.getTime()
    if (!Number.isFinite(ms) || ms < 0) return null
    return Math.floor(ms / (24 * 60 * 60 * 1000))
  }, [dataInclusaoRaw, ultimaMovRaw])

  const anexosCount = useMemo(() => {
    const pc = String((active as any)?.pedido_compra_path || '').trim()
    return (pc ? 1 : 0) + (docsComplementares.length || 0)
  }, [active, docsComplementares.length])

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let v = bytes
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  const tabs = useMemo(() => {
    return [
      { id: 'geral', label: 'Geral', icon: UserRound, count: null },
      { id: 'logistica', label: 'Logística', icon: Truck, count: null },
      { id: 'atividades', label: 'Atividades', icon: Calendar, count: atividades.length },
      { id: 'comentarios', label: 'Comentários', icon: MessageSquareText, count: comentarios.length }
    ] as const
  }, [atividades.length, comentarios.length])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      noPadding
      title={
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Informações da Proposta</div>
            <div className="mt-1 text-base font-black text-slate-100 truncate">
              {active ? `${getCodProposta(active) || '-'} · ${getCliente(active) || '-'}` : '-'}
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-full">
        <div className="px-4 md:px-6 pt-4">
          <HorizontalScrollArea className="w-full overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {tabs.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      tab === t.id ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={12} className={tab === t.id ? 'text-cyan-200' : 'text-slate-400'} />
                      {t.label}
                      {typeof t.count === 'number' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-200">
                          {t.count}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </HorizontalScrollArea>
        </div>

        <div className="px-4 md:px-6 py-4 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-300 gap-2">
              <Loader2 className="animate-spin" size={18} />
              Carregando...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>
          ) : !active ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Proposta não encontrada.</div>
          ) : tab === 'geral' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Código</div>
                  <div className="mt-2 text-2xl font-black text-slate-100">{getCodProposta(active) || '-'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</div>
                  <div className="mt-2 text-lg font-black text-slate-100 truncate">{getCliente(active) || '-'}</div>
                  {String((active as any)?.cliente_documento || '').trim() ? (
                    <div className="mt-1 text-xs text-slate-300">{String((active as any)?.cliente_documento || '').trim()}</div>
                  ) : null}
                </div>
              </div>

              {getDescricao(active) ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solicitação do Cliente</div>
                  <div className="mt-2 text-sm text-slate-100 whitespace-pre-wrap">{getDescricao(active)}</div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Vendedor</div>
                  <div className="mt-2 flex items-center gap-3 min-w-0">
                    {String(vendedorInfo?.avatar_url || '').trim() ? (
                      <img
                        src={String(vendedorInfo?.avatar_url || '').trim()}
                        alt={String(vendedorInfo?.nome || 'Vendedor').trim() || 'Vendedor'}
                        className="h-10 w-10 rounded-full object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 inline-flex items-center justify-center text-xs font-black text-slate-200 shrink-0">
                        {String(vendedorInfo?.nome || '?')
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-100 truncate">{String(vendedorInfo?.nome || '').trim() || '-'}</div>
                      <div className="mt-0.5 text-xs text-slate-400 truncate">
                        {String(vendedorInfo?.cargo || '').trim() || 'Vendedor'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail</div>
                  <div className="mt-2 text-sm font-black text-slate-100">
                    {String(vendedorInfo?.email_corporativo || vendedorInfo?.email_login || '').trim() || '-'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ramal</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{String(vendedorInfo?.ramal || '').trim() || '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Inclusão</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{formatDateTimeBR(dataInclusaoRaw)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo Aberto</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{tempoAbertoLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Última Movimentação</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{formatDateTimeBR(ultimaMovRaw)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dias sem Movimentação</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{diasSemMov === null ? '-' : `${diasSemMov} dia(s)`}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fase</div>
                  <div className="mt-2 text-sm font-black text-slate-100">
                    {getFaseLabel(active) !== '-' ? getFaseLabel(active) : faseLabelById[getFaseId(active)] || '-'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
                  <div className="mt-2 text-sm font-black text-slate-100">
                    {(() => {
                      const direct = getStatusLabel(active)
                      if (direct && direct !== '-' && direct !== getStatusId(active)) return direct
                      const fromId = statusLabelById[getStatusId(active)]
                      return fromId || direct || '-'
                    })()}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsão Entrega</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{formatDateBR(String((active as any)?.prev_entrega || '').trim() || null)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solução</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{String((active as any)?.solucao || '-')}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frete</div>
                  <div className="mt-2 text-sm font-black text-slate-100">{String((active as any)?.tipo_frete || '-')}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atualizado em</div>
                  <div className="mt-2 text-sm font-black text-slate-100">
                    {formatDateTimeBR(String((active as any)?.atualizado_em || (active as any)?.data_alteracao || '').trim() || null)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Arquivos anexados</div>
                  <span className="text-[10px] font-black bg-white/5 text-slate-300 px-2 py-1 rounded-full border border-white/10">{anexosCount}</span>
                </div>

                {docsComplementaresLoading ? (
                  <div className="px-4 py-4 text-xs text-slate-400 inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={14} />
                    Carregando...
                  </div>
                ) : anexosCount === 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400">Nenhum documento anexado ainda.</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {String((active as any)?.pedido_compra_path || '').trim() ? (
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-slate-300 shrink-0" />
                            <div className="text-sm font-bold text-slate-100 truncate">
                              {String((active as any)?.pedido_compra_path || '').trim().split('/').pop() || 'Pedido de Compra'}
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">Pedido de Compra</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const path = String((active as any)?.pedido_compra_path || '').trim()
                            if (!path) return
                            const url = supabase.storage.from(bucketPedidoCompra).getPublicUrl(path).data.publicUrl
                            if (url) window.open(url, '_blank', 'noopener,noreferrer')
                          }}
                          className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors inline-flex items-center justify-center"
                          title="Abrir"
                          aria-label="Abrir"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    ) : null}

                    {docsComplementares.map((d) => (
                      <div key={d.path} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-slate-300 shrink-0" />
                            <div className="text-sm font-bold text-slate-100 truncate">{d.name}</div>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {formatFileSize(d.size)} · {d.mimeType || 'arquivo'} · {formatDateTimeBR(d.createdAt || d.updatedAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const r = await supabase.storage.from(bucketDocsComplementares).createSignedUrl(d.path, 60 * 10)
                              if (r.error) throw r.error
                              const url = r.data?.signedUrl
                              if (url) window.open(url, '_blank', 'noopener,noreferrer')
                            } catch {}
                          }}
                          className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors inline-flex items-center justify-center"
                          title="Abrir"
                          aria-label="Abrir"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'logistica' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-300">Produção</div>
                    <div className="mt-1 text-[11px] text-slate-400">Entrada de equipamento vinculada à proposta</div>
                  </div>
                  <button
                    type="button"
                    disabled={!canOpenEquipmentEntry}
                    onClick={() => setEquipmentEntryOpen(true)}
                    className={`shrink-0 inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.99] ${
                      canOpenEquipmentEntry
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/15'
                        : 'bg-white/5 border border-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Wrench size={16} />
                    Entrada de Equipamento
                  </button>
                </div>
              </div>

              {String((equipmentInitialData as any)?.cod_proposta || '').trim() ? (
                <EquipmentList
                  codProposta={String((equipmentInitialData as any)?.cod_proposta || '').trim()}
                  lastUpdate={equipmentLastUpdate}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  Salve a proposta para vincular equipamentos em produção.
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-300">Logística</div>
                    <div className="mt-1 text-[11px] text-slate-400">Dados de transporte e nota fiscal</div>
                  </div>
                </div>

                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Previsão de Entrega</label>
                      <input
                        readOnly
                        value={formatDateBR(String((active as any)?.prev_entrega || '').trim() || null)}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Nº da Nota Fiscal</label>
                      <input
                        readOnly
                        value={String((active as any)?.numero_nota_fiscal || '').trim() || '-'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Valor da Nota Fiscal</label>
                      <input
                        readOnly
                        value={
                          (active as any)?.valor_nota_fiscal === null || (active as any)?.valor_nota_fiscal === undefined
                            ? '-'
                            : String((active as any)?.valor_nota_fiscal)
                        }
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Transportadora</label>
                      <input
                        readOnly
                        value={String((active as any)?.transportadora || '').trim() || '-'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Remetente Completo</label>
                      <textarea
                        readOnly
                        value={String((active as any)?.remetente_completo || '').trim() || '-'}
                        rows={4}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Destinatário Completo</label>
                      <textarea
                        readOnly
                        value={String((active as any)?.destinatario_completo || '').trim() || '-'}
                        rows={4}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none resize-y"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Material</label>
                      <input
                        readOnly
                        value={String((active as any)?.material || '').trim() || '-'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Quantidade de Volumes</label>
                      <input
                        readOnly
                        value={
                          (active as any)?.quantidade_volumes === null || (active as any)?.quantidade_volumes === undefined
                            ? '-'
                            : String((active as any)?.quantidade_volumes)
                        }
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Espécie</label>
                      <input
                        readOnly
                        value={String((active as any)?.especie || '').trim() || '-'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Peso</label>
                      <input
                        readOnly
                        value={(active as any)?.peso === null || (active as any)?.peso === undefined ? '-' : String((active as any)?.peso)}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Medidas (AxCxL)</label>
                      <input
                        readOnly
                        value={String((active as any)?.medidas || '').trim() || '-'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === 'atividades' ? (
            <div className="space-y-4">
              {!String(oportunidadeId || '').trim() ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  Salve a proposta para registrar e visualizar atividades.
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-300">Atividades</div>
                  <div className="mt-3 space-y-3">
                    {atividades.length === 0 ? (
                      <div className="text-sm text-slate-400">Nenhuma atividade registrada.</div>
                    ) : (
                      atividades.map((a: any) => {
                        const p = (a?.payload || {}) as any
                        const when = new Date(String(a?.created_at || '')).toLocaleString('pt-BR')
                        const createdBy = String(a?.created_by || '').trim() || null
                        const createdByLabel = createdBy ? statusHistoryUserById[createdBy] || createdBy : null

                        const faseDe = p?.de ? faseLabelById[String(p.de).trim()] || String(p.de) : null
                        const fasePara = p?.para ? faseLabelById[String(p.para).trim()] || String(p.para) : null

                        let title = String(a?.tipo || 'ATIVIDADE')
                        let detail: string | null = null

                        if (a?.tipo === 'CRIADA') title = 'Proposta criada'
                        else if (a?.tipo === 'MOVEU_KANBAN') {
                          title = 'Movida no Kanban'
                          detail = faseDe && fasePara ? `${faseDe} → ${fasePara}` : null
                        } else if (a?.tipo === 'ALTEROU_STATUS') {
                          title = 'Status alterado'
                          const fromDesc = p?.de ? statusLabelById[String(p.de).trim()] || String(p.de) : '-'
                          const toDesc = p?.para ? statusLabelById[String(p.para).trim()] || String(p.para) : '-'
                          detail = `${fromDesc} → ${toDesc}`
                        } else if (a?.tipo === 'ALTEROU_VALOR') {
                          title = 'Valor alterado'
                          detail = `${String(p?.de ?? '-')} → ${String(p?.para ?? '-')}`
                        } else if (a?.tipo === 'ALTEROU_PREVISAO') {
                          title = 'Previsão alterada'
                          detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                        } else if (a?.tipo === 'ALTEROU_TEMPERATURA') {
                          title = 'Temperatura alterada'
                          detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                        } else if (a?.tipo === 'ALTEROU_SOLUCAO') {
                          title = 'Solução alterada'
                          detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                        } else if (a?.tipo === 'ALTEROU_SOLICITACAO_CLIENTE') {
                          title = 'Solicitação do cliente alterada'
                          detail = null
                        } else if (a?.tipo === 'ALTEROU_OBSERVACOES') {
                          title = 'Observações alteradas'
                          detail = null
                        } else if (a?.tipo === 'COMENTARIO') {
                          title = 'Comentário'
                          detail = String(p?.comentario || '').trim() || null
                        }

                        return (
                          <div key={String(a?.atividade_id || Math.random())} className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-sm font-black text-slate-100">{title}</div>
                                {detail ? <div className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">{detail}</div> : null}
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <div className="text-[11px] font-bold text-slate-400">{when}</div>
                                <div className="text-[11px] text-slate-300" title={createdBy || undefined}>
                                  {createdByLabel || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'comentarios' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300">Adicionar Comentário</div>
                <textarea
                  value={comentarioTexto}
                  onChange={(e) => setComentarioTexto(e.target.value)}
                  className="mt-3 w-full h-28 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
                  placeholder="Escreva um comentário..."
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      const text = comentarioTexto.trim()
                      if (!text) return
                      const id = String(oportunidadeId || '').trim()
                      if (!id) return
                      if (comentarioSaving) return
                      setComentarioSaving(true)
                      try {
                        await createOportunidadeComentario(id, text)
                        const [rows, acts] = await Promise.all([
                          fetchOportunidadeComentarios(id).catch(() => [] as any[]),
                          fetchOportunidadeAtividades(id).catch(() => [] as any[])
                        ])
                        setComentarios(Array.isArray(rows) ? (rows as any) : [])
                        setAtividades(Array.isArray(acts) ? (acts as any) : [])
                        setComentarioTexto('')
                      } finally {
                        setComentarioSaving(false)
                      }
                    }}
                    disabled={comentarioSaving || !comentarioTexto.trim()}
                    className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                  >
                    {comentarioSaving ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300">Comentários</div>
                <div className="mt-3 space-y-3">
                  {(comentarios || [])
                    .filter((c: any) => {
                      const raw = String(c?.comentario || '').trim()
                      const firstLine = String(raw.split('\n')[0] || '').trim().toLowerCase()
                      if (firstLine.startsWith('status alterado:')) return false
                      if (firstLine.startsWith('fase alterada:')) return false
                      if (firstLine.startsWith('andamento:')) return false
                      return true
                    })
                    .slice()
                    .sort((a: any, b: any) => new Date(String(b?.created_at || '')).getTime() - new Date(String(a?.created_at || '')).getTime())
                    .map((c: any) => {
                      const when = new Date(String(c?.created_at || '')).toLocaleString('pt-BR')
                      const createdBy = String(c?.created_by || '').trim()
                      const author = createdBy ? statusHistoryUserById[createdBy] || createdBy : 'Usuário'
                      const text = String(c?.comentario || '').trim() || '-'
                      return (
                        <div key={String(c?.comentario_id || '') || `${when}-${Math.random()}`} className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
                          <div className="text-[11px] text-slate-400">
                            {author} comentou • {when}
                          </div>
                          <div className="mt-2 text-sm text-slate-100 whitespace-pre-wrap">{text}</div>
                        </div>
                      )
                    })}
                  {(comentarios || []).filter((c: any) => {
                    const raw = String(c?.comentario || '').trim()
                    const firstLine = String(raw.split('\n')[0] || '').trim().toLowerCase()
                    if (firstLine.startsWith('status alterado:')) return false
                    if (firstLine.startsWith('fase alterada:')) return false
                    if (firstLine.startsWith('andamento:')) return false
                    return true
                  }).length === 0 ? <div className="text-sm text-slate-400">Nenhum comentário.</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <EquipmentEntryModal
        isOpen={equipmentEntryOpen}
        onClose={() => setEquipmentEntryOpen(false)}
        initialData={equipmentInitialData}
        onSuccess={() => setEquipmentLastUpdate(Date.now())}
      />
    </Modal>
  )
}
