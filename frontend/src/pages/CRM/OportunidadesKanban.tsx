import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Calendar, 
  Loader2,
  Trash2
} from 'lucide-react'
import { supabase } from '@/services/supabase'
import {
  CRM_Oportunidade,
  CRM_Status,
  CRM_Produto,
  CRM_Servico,
  CRM_Motivo,
  CRM_OrigemLead,
  CRM_OportunidadeItem,
  CRM_OportunidadeComentario,
  CRM_OportunidadeAtividade,
  fetchCrmFases,
  fetchCrmMotivos,
  fetchCrmOrigensLead,
  fetchCrmProdutos,
  fetchCrmServicos,
  fetchCrmStatus,
  fetchOportunidades,
  fetchOportunidadeItens,
  fetchOportunidadeComentarios,
  fetchOportunidadeAtividades,
  createOportunidadeComentario,
  updateOportunidade,
  createOportunidade,
  replaceOportunidadeItens
} from '@/services/crm'
import { fetchClientes, Cliente } from '@/services/clientes'
import { fetchClienteContatos, ClienteContato, createClienteContato } from '@/services/clienteContatos'
import { HorizontalScrollArea, Modal } from '@/components/ui'
import { useUsuarios, UsuarioSimples } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'

type Stage = { id: string; label: string; ordem: number; cor: string | null }

type DraftItem = {
  localId: string
  tipo: 'PRODUTO' | 'SERVICO'
  produtoId: string | null
  servicoId: string | null
  descricao: string
  quantidade: number
  descontoPercent: number
  valorUnitario: number
}

const calcItemTotal = (item: DraftItem) => {
  const qtd = Number(item.quantidade || 0)
  const unit = Number(item.valorUnitario || 0)
  const desc = Number(item.descontoPercent || 0)
  const factor = 1 - Math.min(100, Math.max(0, desc)) / 100
  const total = unit * qtd * factor
  return Number.isFinite(total) ? total : 0
}

const FALLBACK_STAGES: Stage[] = [
  { id: 'Lead', label: 'Lead', ordem: 10, cor: '#94a3b8' },
  { id: 'Prospecção', label: 'Prospecção', ordem: 20, cor: '#60a5fa' },
  { id: 'Apresentação', label: 'Apresentação', ordem: 30, cor: '#818cf8' },
  { id: 'Qualificação', label: 'Qualificação', ordem: 40, cor: '#a78bfa' },
  { id: 'Negociação', label: 'Negociação', ordem: 50, cor: '#fbbf24' },
  { id: 'Conquistado', label: 'Conquistado', ordem: 60, cor: '#34d399' },
  { id: 'Perdidos', label: 'Perdidos', ordem: 70, cor: '#fb7185' },
  { id: 'Pós-Venda', label: 'Pós-Venda', ordem: 80, cor: '#22d3ee' }
]

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((value || '').trim())

const uuidOrNull = (value: string | null | undefined) => {
  const v = String(value || '').trim()
  return v && isUuid(v) ? v : null
}

const hexToRgba = (hex: string, alpha: number) => {
  const h = (hex || '').trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'R$ 0,00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const getValorNumber = (op: any) => {
  const raw = op?.ticket_valor ?? op?.valor_proposta
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const cleaned = String(raw).replace(/[^0-9,.\-]/g, '')
  const normalized = cleaned.includes(',') ? cleaned.replaceAll('.', '').replace(',', '.') : cleaned
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR')
}

const formatMonthYear = (dateString: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  const fmt = new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' }).format(dt)
  return fmt.replace(' ', '')
}

const getInitials = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Componente do Cartão de Proposta Comercial
const OpportunityCard = ({
  opportunity,
  index,
  onOpen,
  clienteNome,
  contatoNome,
  vendedorNome,
  vendedorAvatarUrl
}: {
  opportunity: CRM_Oportunidade
  index: number
  onOpen: (id: string) => void
  clienteNome: string | null
  contatoNome: string | null
  vendedorNome: string | null
  vendedorAvatarUrl: string | null
}) => {
  const id = opportunity.id_oport || (opportunity as any).id_oportunidade
  const cod = opportunity.cod_oport || (opportunity as any).cod_oportunidade || null
  const clienteLabel =
    opportunity.cliente ||
    clienteNome ||
    (opportunity.id_cliente ? `Cliente #${String(opportunity.id_cliente).split('-')[0]}` : null) ||
    'Novo Cliente'
  const contatoLabel =
    opportunity.nome_contato ||
    contatoNome ||
    (opportunity.id_contato ? `Contato #${String(opportunity.id_contato).split('-')[0]}` : null) ||
    null
  const valor = opportunity.ticket_valor ?? (opportunity.valor_proposta ? Number.parseFloat(String(opportunity.valor_proposta).replace(',', '.')) : null)
  const previsao = opportunity.prev_entrega || null
  const vendedorLabel = (opportunity.vendedor || vendedorNome || '').trim() || null
  const temperatura = Number(opportunity.temperatura || 0) || 0
  const tempBucket =
    temperatura > 0 && temperatura <= 40 ? 'FRIO' : temperatura <= 60 ? 'MORNO' : temperatura > 0 ? 'QUENTE' : null
  const tempLevel = tempBucket === 'FRIO' ? 1 : tempBucket === 'MORNO' ? 2 : tempBucket === 'QUENTE' ? 3 : 0
  const tempColor = tempBucket === 'FRIO' ? 'bg-sky-500' : tempBucket === 'MORNO' ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onDoubleClick={() => onOpen(id)}
          className={`
            group relative flex flex-col gap-3 p-4 mb-3 rounded-xl border transition-all duration-200
            ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500 rotate-2 scale-105 z-50 bg-[#1E293B]' : 'bg-[#0F172A] border-white/5 shadow-sm hover:shadow-md hover:border-white/10'}
          `}
        >
          {/* Header: Cliente/Código e Valor */}
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-sm font-bold text-slate-100 truncate" title={clienteLabel}>
                  {clienteLabel}
                </h4>
                {cod ? (
                  <span className="shrink-0 text-[10px] font-black text-slate-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    #{cod}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end">
               <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                 {formatCurrency(valor)}
               </span>
            </div>
          </div>

          {/* Body: Detalhes */}
          {(opportunity.solucao || vendedorLabel || contatoLabel) && (
             <div className="text-xs text-slate-400 line-clamp-2 bg-white/5 p-2 rounded-lg border border-white/5">
               {contatoLabel && <div className="font-medium text-slate-300 mb-1">{`Contato: ${contatoLabel}`}</div>}
               {vendedorLabel && <div className="text-[10px] text-slate-500">{`Vendedor: ${vendedorLabel}`}</div>}
               {opportunity.solucao && <div className="text-[10px] text-slate-500">{`Solução: ${opportunity.solucao}`}</div>}
             </div>
          )}

          {/* Footer: Datas e Responsável */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
             <div className="min-w-0">
               <div className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Data de inclusão">
                  <Calendar size={12} />
                  <span>{`Incl.: ${formatDate(opportunity.data_inclusao)}`}</span>
               </div>
               <div className="mt-0.5 text-[10px] font-bold text-slate-500 truncate">
                 {`Fech.: ${formatMonthYear(previsao)}`}
               </div>
             </div>

             <div className="flex items-center gap-2">
              {tempBucket && (
                <div className="flex items-center gap-2" title={`Temperatura: ${temperatura}% (${tempBucket})`}>
                  <div className="flex items-end gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-5 rounded-full ${i <= tempLevel ? tempColor : 'bg-slate-700'}`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      tempBucket === 'FRIO'
                        ? 'text-sky-200 bg-sky-500/10 border-sky-500/20'
                        : tempBucket === 'MORNO'
                          ? 'text-amber-200 bg-amber-500/10 border-amber-500/20'
                          : 'text-rose-200 bg-rose-500/10 border-rose-500/20'
                    }`}
                  >
                    {tempBucket}
                  </span>
                </div>
              )}

              <div
                className="w-8 h-8 rounded-full border border-cyan-500/20 bg-cyan-900/20 overflow-hidden flex items-center justify-center text-[10px] font-black text-cyan-100"
                title={vendedorLabel || 'Vendedor'}
              >
                {vendedorAvatarUrl ? (
                  <img src={vendedorAvatarUrl} alt={vendedorLabel || 'Vendedor'} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(vendedorLabel || String(opportunity.id_vendedor || ''))}</span>
                )}
              </div>
             </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}

export default function OportunidadesKanban() {
  const [opportunities, setOpportunities] = useState<CRM_Oportunidade[]>([])
  const [stages, setStages] = useState<Stage[]>(FALLBACK_STAGES)
  const [statuses, setStatuses] = useState<CRM_Status[]>([])
  const [produtos, setProdutos] = useState<CRM_Produto[]>([])
  const [servicos, setServicos] = useState<CRM_Servico[]>([])
  const [motivos, setMotivos] = useState<CRM_Motivo[]>([])
  const [origens, setOrigens] = useState<CRM_OrigemLead[]>([])
  const [clienteNameById, setClienteNameById] = useState<Record<string, string>>({})
  const [contatoNameById, setContatoNameById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createClienteQuery, setCreateClienteQuery] = useState('')
  const [createClienteId, setCreateClienteId] = useState('')
  const [createClienteOpen, setCreateClienteOpen] = useState(false)
  const [createClienteLoading, setCreateClienteLoading] = useState(false)
  const [createClienteOptions, setCreateClienteOptions] = useState<Cliente[]>([])
  const [createContatoId, setCreateContatoId] = useState('')
  const [createContatoLoading, setCreateContatoLoading] = useState(false)
  const [createContatoOptions, setCreateContatoOptions] = useState<ClienteContato[]>([])
  const [createOrigemId, setCreateOrigemId] = useState('')
  const [createVendedorId, setCreateVendedorId] = useState('')
  const [createSolucao, setCreateSolucao] = useState<'PRODUTO' | 'SERVICO' | 'PRODUTO_SERVICO'>('PRODUTO')
  const [createTicket, setCreateTicket] = useState('')
  const [createPrevFechamento, setCreatePrevFechamento] = useState('')
  const [createSolicitacao, setCreateSolicitacao] = useState('')
  const [createContatoModalOpen, setCreateContatoModalOpen] = useState(false)
  const [createContatoNome, setCreateContatoNome] = useState('')
  const [createContatoEmail, setCreateContatoEmail] = useState('')
  const [createContatoTelefone, setCreateContatoTelefone] = useState('')
  const [createContatoSaving, setCreateContatoSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [draftCod, setDraftCod] = useState('')
  const [draftVendedorId, setDraftVendedorId] = useState('')
  const [draftClienteId, setDraftClienteId] = useState('')
  const [draftContatoId, setDraftContatoId] = useState('')
  const [draftFaseId, setDraftFaseId] = useState('')
  const [draftStatusId, setDraftStatusId] = useState('')
  const [draftMotivoId, setDraftMotivoId] = useState('')
  const [draftOrigemId, setDraftOrigemId] = useState('')
  const [draftSolucao, setDraftSolucao] = useState<'PRODUTO' | 'SERVICO' | 'PRODUTO_SERVICO'>('PRODUTO')
  const [draftTicket, setDraftTicket] = useState('')
  const [draftTemperatura, setDraftTemperatura] = useState('50')
  const [draftQtd, setDraftQtd] = useState('1')
  const [draftPrevEntrega, setDraftPrevEntrega] = useState('')
  const [draftProdutoId, setDraftProdutoId] = useState('')
  const [draftServicoId, setDraftServicoId] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftItens, setDraftItens] = useState<DraftItem[]>([])
  const [tab, setTab] = useState<'ticket' | 'previsaoTemperatura' | 'observacoes' | 'comentarios' | 'historico'>('ticket')

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemModalTipo, setItemModalTipo] = useState<'PRODUTO' | 'SERVICO'>('PRODUTO')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSelectedId, setItemSelectedId] = useState<string>('')
  const [itemQuantidade, setItemQuantidade] = useState('1')
  const [itemDesconto, setItemDesconto] = useState('0')

  const [comentarios, setComentarios] = useState<CRM_OportunidadeComentario[]>([])
  const [comentariosDraft, setComentariosDraft] = useState<Array<{ localId: string; comentario: string; createdAt: string }>>([])
  const [comentarioTexto, setComentarioTexto] = useState('')
  const [comentarioSaving, setComentarioSaving] = useState(false)

  const [atividades, setAtividades] = useState<CRM_OportunidadeAtividade[]>([])

  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteOpen, setClienteOpen] = useState(false)
  const [clienteLoading, setClienteLoading] = useState(false)
  const [clienteOptions, setClienteOptions] = useState<Cliente[]>([])

  const [contatoQuery, setContatoQuery] = useState('')
  const [contatoOpen, setContatoOpen] = useState(false)
  const [contatoLoading, setContatoLoading] = useState(false)
  const [contatoOptions, setContatoOptions] = useState<ClienteContato[]>([])

  const [vendedorQuery, setVendedorQuery] = useState('')
  const [vendedorOpen, setVendedorOpen] = useState(false)

  const [origemQuery, setOrigemQuery] = useState('')
  const [origemOpen, setOrigemOpen] = useState(false)

  const active = useMemo(() => opportunities.find(o => (o.id_oport || (o as any).id_oportunidade) === activeId) || null, [opportunities, activeId])

  const { session, profile, can } = useAuth()
  const canCrmControl = can('CRM', 'CONTROL')
  const myUserId = (profile?.id || session?.user?.id || '').trim()
  const myUserName = (profile?.nome || '').trim()

  const { usuarios } = useUsuarios()
  const vendedorNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of usuarios as any[]) {
      if (u?.id && u?.nome) m[String(u.id)] = String(u.nome)
    }
    return m
  }, [usuarios])
  const vendedorAvatarById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of usuarios as any[]) {
      if (u?.id && u?.avatar_url) m[String(u.id)] = String(u.avatar_url)
    }
    return m
  }, [usuarios])

  const leadStageId = useMemo(() => {
    const lead = stages.find(s => (s.label || '').trim().toLowerCase() === 'lead')
    return lead?.id || (stages[0]?.id || '')
  }, [stages])

  const andamentoStatusId = useMemo(() => {
    const normalized = statuses.slice().sort((a, b) => {
      const ao = Number(a.status_ordem ?? 0)
      const bo = Number(b.status_ordem ?? 0)
      return ao - bo || String(a.status_desc || '').localeCompare(String(b.status_desc || ''))
    })
    const andamento = normalized.find(s => String(s.status_desc || '').trim().toLowerCase() === 'andamento')
    return andamento?.status_id || (normalized[0]?.status_id || '')
  }, [statuses])

  const stageLabelById = useMemo(() => new Map(stages.map((s) => [s.id, s.label])), [stages])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [data, fases, sts] = await Promise.all([fetchOportunidades({ orderDesc: true }), fetchCrmFases(), fetchCrmStatus()])
      setOpportunities(data)
      setStatuses(sts)
      try {
        const clienteIds = Array.from(
          new Set(
            (data || [])
              .map((o) => (o as any)?.id_cliente)
              .filter((x) => typeof x === 'string' && x.trim().length > 0)
          )
        )
        const contatoIds = Array.from(
          new Set(
            (data || [])
              .map((o) => (o as any)?.id_contato)
              .filter((x) => typeof x === 'string' && x.trim().length > 0)
          )
        )

        if (clienteIds.length > 0) {
          const { data: rows, error } = await (supabase as any)
            .from('crm_clientes')
            .select('cliente_id, cliente_nome_razao_social, deleted_at')
            .in('cliente_id', clienteIds)
            .is('deleted_at', null)
          if (!error) {
            const map: Record<string, string> = {}
            for (const r of rows || []) {
              if (r?.cliente_id && r?.cliente_nome_razao_social) map[String(r.cliente_id)] = String(r.cliente_nome_razao_social)
            }
            setClienteNameById(map)
          }
        }

        if (contatoIds.length > 0) {
          const { data: rows, error } = await (supabase as any)
            .from('crm_contatos')
            .select('contato_id, contato_nome, deleted_at')
            .in('contato_id', contatoIds)
            .is('deleted_at', null)
          if (!error) {
            const map: Record<string, string> = {}
            for (const r of rows || []) {
              if (r?.contato_id && r?.contato_nome) map[String(r.contato_id)] = String(r.contato_nome)
            }
            setContatoNameById(map)
          }
        }
      } catch {
        setClienteNameById({})
        setContatoNameById({})
      }

      const mapped = (fases || [])
        .map((e) => ({
          id: e.fase_id,
          label: (e.fase_desc || '').trim(),
          ordem: Number(e.fase_ordem ?? 0),
          cor: e.fase_cor || null
        }))
        .filter((s) => Boolean(s.id) && Boolean(s.label))

      const unique = new Map<string, Stage>()
      for (const s of mapped) {
        if (!unique.has(s.id)) unique.set(s.id, s)
      }

      const stageList = Array.from(unique.values()).sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))

      setStages(stageList.length > 0 ? stageList : FALLBACK_STAGES)
    } catch (error) {
      console.error('Failed to load opportunities', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!createOpen) return
    setCreateError(null)
    if (!origens.length) {
      fetchCrmOrigensLead()
        .then((o) => setOrigens(o))
        .catch(() => setOrigens([]))
    }
  }, [createOpen, origens.length])

  useEffect(() => {
    if (!createOpen) return
    if (canCrmControl) return
    if (!myUserId) return
    if (createVendedorId.trim()) return
    setCreateVendedorId(myUserId)
  }, [createOpen, canCrmControl, myUserId, createVendedorId])

  useEffect(() => {
    if (!createOpen) return
    const term = createClienteQuery.trim()
    if (!term) {
      setCreateClienteOptions([])
      return
    }
    const handle = window.setTimeout(async () => {
      setCreateClienteLoading(true)
      try {
        const data = await fetchClientes({ search: term })
        setCreateClienteOptions(data.slice(0, 12))
      } finally {
        setCreateClienteLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [createOpen, createClienteQuery])

  useEffect(() => {
    if (!createOpen) return
    const clienteId = createClienteId.trim()
    if (!clienteId) {
      setCreateContatoOptions([])
      setCreateContatoId('')
      return
    }
    setCreateContatoLoading(true)
    fetchClienteContatos(clienteId)
      .then((data) => setCreateContatoOptions(data))
      .finally(() => setCreateContatoLoading(false))
  }, [createOpen, createClienteId])

  useEffect(() => {
    if (!formOpen) return
    setFormError(null)
    if (active) {
      setDraftCod(active.cod_oport || active.cod_oportunidade || '')
      setDraftVendedorId(active.id_vendedor || '')
      setDraftClienteId(active.id_cliente || '')
      setDraftContatoId(active.id_contato || '')
      setDraftFaseId(active.id_fase || '')
      setDraftStatusId(active.id_status || '')
      setDraftMotivoId(active.id_motivo || '')
      setDraftOrigemId(active.id_origem || '')
      setDraftSolucao((active.solucao as any) || 'PRODUTO')
      setDraftTicket(active.ticket_valor === null || active.ticket_valor === undefined ? '' : String(active.ticket_valor))
      setDraftTemperatura(active.temperatura === null || active.temperatura === undefined ? '50' : String(active.temperatura))
      setDraftQtd(active.qts_item === null || active.qts_item === undefined ? '1' : String(active.qts_item))
      setDraftPrevEntrega(active.prev_entrega ? String(active.prev_entrega).slice(0, 7) : '')
      setDraftProdutoId(active.cod_produto || '')
      setDraftServicoId(active.cod_servico || '')
      setDraftObs(active.obs_oport || '')
      setDraftDescricao(active.descricao_oport || '')
      setDraftItens([])

      setClienteQuery(active.cliente || '')
      setContatoQuery(active.nome_contato || '')
      setVendedorQuery(active.vendedor || '')
      setOrigemQuery(active.origem || '')
      setComentarios([])
      setComentariosDraft([])
      setComentarioTexto('')
      setAtividades([])
    } else {
      setDraftCod('')
      setDraftVendedorId(canCrmControl ? '' : myUserId)
      setDraftClienteId('')
      setDraftContatoId('')
      setDraftFaseId(leadStageId || '')
      setDraftStatusId(andamentoStatusId || '')
      setDraftMotivoId('')
      setDraftOrigemId('')
      setDraftSolucao('PRODUTO')
      setDraftTicket('')
      setDraftTemperatura('50')
      setDraftQtd('1')
      {
        const now = new Date()
        setDraftPrevEntrega(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      }
      setDraftProdutoId('')
      setDraftServicoId('')
      setDraftObs('')
      setDraftDescricao('')
      setDraftItens([])

      setClienteQuery('')
      setContatoQuery('')
      setVendedorQuery(canCrmControl ? '' : myUserName)
      setOrigemQuery('')
      setComentarios([])
      setComentariosDraft([])
      setComentarioTexto('')
      setAtividades([])
    }
    setClienteOpen(false)
    setContatoOpen(false)
    setVendedorOpen(false)
    setOrigemOpen(false)
    setTab('ticket')
  }, [formOpen, active, stages, leadStageId, andamentoStatusId])

  useEffect(() => {
    if (!formOpen) return
    if (draftSolucao === 'PRODUTO') {
      setDraftItens((prev) => prev.filter((i) => i.tipo === 'PRODUTO'))
    } else if (draftSolucao === 'SERVICO') {
      setDraftItens((prev) => prev.filter((i) => i.tipo === 'SERVICO'))
    }
  }, [formOpen, draftSolucao])

  useEffect(() => {
    if (!formOpen) return
    if (activeId) return
    if (!draftFaseId && leadStageId) setDraftFaseId(leadStageId)
    if (!draftStatusId && andamentoStatusId) setDraftStatusId(andamentoStatusId)
  }, [formOpen, activeId, draftFaseId, draftStatusId, leadStageId, andamentoStatusId])

  useEffect(() => {
    if (!formOpen) return
    Promise.all([fetchCrmProdutos(), fetchCrmServicos(), fetchCrmMotivos(), fetchCrmOrigensLead()])
      .then(([p, s, m, o]) => {
        setProdutos(p)
        setServicos(s)
        setMotivos(m)
        setOrigens(o)
      })
      .catch(() => {
        setProdutos([])
        setServicos([])
        setMotivos([])
        setOrigens([])
      })
  }, [formOpen, active, leadStageId, andamentoStatusId, canCrmControl, myUserId, myUserName])

  useEffect(() => {
    if (!formOpen) return
    if (!activeId) return

    fetchOportunidadeItens(activeId)
      .then((rows: CRM_OportunidadeItem[]) => {
        const mapped: DraftItem[] = (rows || []).map((r) => ({
          localId: r.item_id,
          tipo: r.tipo,
          produtoId: r.produto_id ?? null,
          servicoId: r.servico_id ?? null,
          descricao: r.descricao_item || (r.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'),
          quantidade: Number(r.quantidade || 1),
          descontoPercent: Number(r.desconto_percent || 0),
          valorUnitario: Number(r.valor_unitario || 0),
        }))
        setDraftItens(mapped)
      })
      .catch(() => setDraftItens([]))
  }, [formOpen, activeId])

  useEffect(() => {
    if (!formOpen) return
    if (!activeId) return
    fetchOportunidadeComentarios(activeId)
      .then((rows: CRM_OportunidadeComentario[]) => setComentarios(rows))
      .catch(() => setComentarios([]))
  }, [formOpen, activeId])

  useEffect(() => {
    if (!formOpen) return
    if (!activeId) return
    fetchOportunidadeAtividades(activeId)
      .then((rows: CRM_OportunidadeAtividade[]) => setAtividades(rows))
      .catch(() => setAtividades([]))
  }, [formOpen, activeId])

  useEffect(() => {
    if (!formOpen) return
    if (!activeId) return
    if (!active) return
    if (draftItens.length > 0) return

    const qtd = Number(active.qts_item || 1) || 1
    const total = Number(active.ticket_valor || 0) || 0
    const unit = qtd > 0 ? total / qtd : total
    const codProduto = (active as any).cod_produto || null
    const codServico = (active as any).cod_servico || null
    if (codProduto) {
      setDraftItens([
        {
          localId: `legacy-${activeId}-p`,
          tipo: 'PRODUTO',
          produtoId: codProduto,
          servicoId: null,
          descricao: active.descricao_oport || 'Produto',
          quantidade: qtd,
          descontoPercent: 0,
          valorUnitario: unit
        }
      ])
      return
    }
    if (codServico) {
      setDraftItens([
        {
          localId: `legacy-${activeId}-s`,
          tipo: 'SERVICO',
          produtoId: null,
          servicoId: codServico,
          descricao: active.descricao_oport || 'Serviço',
          quantidade: qtd,
          descontoPercent: 0,
          valorUnitario: unit
        }
      ])
    }
  }, [formOpen, activeId, active, draftItens.length])

  useEffect(() => {
    if (!formOpen) return
    if (!clienteOpen) return
    const term = clienteQuery.trim()
    if (!term) {
      setClienteOptions([])
      return
    }
    const handle = window.setTimeout(async () => {
      setClienteLoading(true)
      try {
        const data = await fetchClientes({ search: term })
        setClienteOptions(data.slice(0, 12))
      } finally {
        setClienteLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [formOpen, clienteOpen, clienteQuery])

  useEffect(() => {
    if (!formOpen) return
    const clienteId = draftClienteId.trim()
    if (!clienteId) {
      setContatoOptions([])
      setDraftContatoId('')
      setContatoQuery('')
      return
    }
    setContatoLoading(true)
    fetchClienteContatos(clienteId)
      .then((data) => {
        setContatoOptions(data)
      })
      .finally(() => setContatoLoading(false))
  }, [formOpen, draftClienteId])

  const ticketCalculado = useMemo(() => {
    const total = (draftItens || []).reduce((acc, item) => acc + calcItemTotal(item), 0)
    return Number.isFinite(total) ? total : 0
  }, [draftItens])

  const itemOptions = useMemo(() => {
    const term = (itemSearch || '').trim().toLowerCase()
    const list = itemModalTipo === 'PRODUTO' ? produtos : servicos
    const mapped = list.map((x: any) => ({
      id: itemModalTipo === 'PRODUTO' ? x.prod_id : x.serv_id,
      label: itemModalTipo === 'PRODUTO' ? x.descricao_prod : x.descricao_serv,
      valor: Number(itemModalTipo === 'PRODUTO' ? x.produto_valor : x.servicos_valor) || 0
    }))
    if (!term) return mapped.slice(0, 12)
    return mapped
      .filter((x) => String(x.label || '').toLowerCase().includes(term))
      .slice(0, 12)
  }, [itemSearch, itemModalTipo, produtos, servicos])

  const itemSelected = useMemo(() => {
    const id = (itemSelectedId || '').trim()
    if (!id) return null
    if (itemModalTipo === 'PRODUTO') {
      const p = produtos.find((x) => x.prod_id === id)
      if (!p) return null
      return { tipo: 'PRODUTO' as const, id: p.prod_id, descricao: p.descricao_prod, valorUnitario: Number(p.produto_valor || 0) }
    }
    const s = servicos.find((x) => x.serv_id === id)
    if (!s) return null
    return { tipo: 'SERVICO' as const, id: s.serv_id, descricao: s.descricao_serv, valorUnitario: Number(s.servicos_valor || 0) }
  }, [itemSelectedId, itemModalTipo, produtos, servicos])

  const contatoFiltered = useMemo(() => {
    const term = contatoQuery.trim().toLowerCase()
    if (!term) return contatoOptions.slice(0, 12)
    return contatoOptions
      .filter((c) => {
        const txt = `${c.contato_nome} ${c.contato_email || ''} ${c.contato_telefone01 || ''} ${c.contato_telefone02 || ''}`.toLowerCase()
        return txt.includes(term)
      })
      .slice(0, 12)
  }, [contatoOptions, contatoQuery])

  const vendedorFiltered = useMemo(() => {
    const term = vendedorQuery.trim().toLowerCase()
    if (!term) return usuarios.slice(0, 12)
    return usuarios
      .filter((u) => {
        const txt = `${u.nome} ${u.email_corporativo || ''} ${u.email_login || ''}`.toLowerCase()
        return txt.includes(term)
      })
      .slice(0, 12)
  }, [usuarios, vendedorQuery])

  const origemFiltered = useMemo(() => {
    const term = origemQuery.trim().toLowerCase()
    if (!term) return origens.slice(0, 12)
    return origens
      .filter((o) => String(o.descricao_orig || '').toLowerCase().includes(term))
      .slice(0, 12)
  }, [origens, origemQuery])

  const openCreate = () => {
    setCreateError(null)
    setCreateClienteQuery('')
    setCreateClienteId('')
    setCreateClienteOpen(false)
    setCreateClienteOptions([])
    setCreateContatoId('')
    setCreateContatoOptions([])
    setCreateOrigemId('')
    setCreateVendedorId(canCrmControl ? '' : myUserId)
    setCreateSolucao('PRODUTO')
    setCreateTicket('')
    {
      const now = new Date()
      setCreatePrevFechamento(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    setCreateSolicitacao('')
    setCreateContatoNome('')
    setCreateContatoEmail('')
    setCreateContatoTelefone('')
    setCreateContatoModalOpen(false)
    setCreateOpen(true)
  }

  const openEdit = (id: string) => {
    setActiveId(id)
    setFormOpen(true)
  }

  const handleCreateOportunidade = async () => {
    const clienteId = createClienteId.trim()
    const contatoId = createContatoId.trim()
    const origemId = createOrigemId.trim()
    const vendedorId = (canCrmControl ? createVendedorId : myUserId).trim()
    const ticketValor = parseMoney(createTicket)
    const prevEntrega = createPrevFechamento.trim() ? `${createPrevFechamento.trim()}-01` : null
    const solicitacao = createSolicitacao.trim()

    if (!clienteId) {
      setCreateError('Selecione um cliente.')
      return
    }
    if (!contatoId) {
      setCreateError('Selecione um contato (ou adicione um novo).')
      return
    }
    if (!origemId) {
      setCreateError('Selecione uma origem.')
      return
    }
    if (!vendedorId) {
      setCreateError('Selecione um vendedor.')
      return
    }
    if (!Number.isFinite(ticketValor) || ticketValor <= 0) {
      setCreateError('Informe um valor (maior que 0).')
      return
    }
    if (!prevEntrega) {
      setCreateError('Informe a previsão de fechamento (mês/ano).')
      return
    }
    if (!solicitacao) {
      setCreateError('Informe a solicitação do cliente.')
      return
    }

    setCreateSaving(true)
    setCreateError(null)
    try {
      const faseId = leadStageId || stages[0]?.id || null
      const statusId = andamentoStatusId || null
      const faseLabel = faseId ? (stages.find((s) => s.id === faseId)?.label || null) : null

      const created = await createOportunidade({
        id_cliente: clienteId,
        id_contato: contatoId,
        id_origem: origemId,
        id_vendedor: vendedorId,
        id_fase: faseId,
        id_status: statusId,
        id_motivo: null,
        solucao: createSolucao,
        qts_item: null,
        prev_entrega: prevEntrega,
        cod_produto: null,
        cod_servico: null,
        ticket_valor: ticketValor,
        temperatura: null,
        obs_oport: null,
        descricao_oport: solicitacao,
        fase: faseLabel
      } as any)

      setCreateOpen(false)
      setOpportunities((prev) => {
        const contatoNome =
          createContatoOptions.find((c) => c.contato_id === contatoId)?.contato_nome || null
        const enriched: any = {
          ...(created as any),
          cliente: (createClienteQuery || '').trim() || (created as any)?.cliente || null,
          nome_contato: contatoNome || (created as any)?.nome_contato || null,
          vendedor: (vendedorNameById[vendedorId] || myUserName || '').trim() || (created as any)?.vendedor || null
        }
        const id = (created as any)?.id_oport || (created as any)?.id_oportunidade
        if (!id) return prev
        if (prev.some((p) => (p.id_oport || (p as any).id_oportunidade) === id)) return prev
        return [enriched as any, ...prev]
      })
      await loadData()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Falha ao criar.')
    } finally {
      setCreateSaving(false)
    }
  }

  const parseMoney = (input: string) => {
    const raw = (input || '').trim()
    if (!raw) return null
    const cleaned = raw.replace(/[^\d,.-]/g, '')
    if (!cleaned) return null
    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')
    let normalized = cleaned
    if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.')
    else normalized = cleaned.replace(',', '.')
    const v = Number.parseFloat(normalized)
    return Number.isFinite(v) ? v : null
  }

  const handleSave = async () => {
    const clienteId = draftClienteId.trim()
    const vendedorId = (canCrmControl ? draftVendedorId : (myUserId || draftVendedorId)).trim()
    if (!clienteId) {
      setFormError('Selecione um cliente.')
      return
    }
    if (!vendedorId) {
      setFormError('Selecione um vendedor.')
      return
    }

    const temp = Number.parseInt(draftTemperatura, 10)
    const temperatura = Number.isFinite(temp) ? Math.min(100, Math.max(1, temp)) : null
    const qts_item = draftItens.length
      ? draftItens.reduce((acc, it) => acc + (Number(it.quantidade || 0) || 0), 0)
      : null
    const prev_entrega = draftPrevEntrega ? `${draftPrevEntrega}-01` : null
    const finalFaseId = activeId ? draftFaseId : (leadStageId || draftFaseId)
    const finalStatusId = activeId ? draftStatusId : (andamentoStatusId || draftStatusId)
    const faseLabel = stages.find(s => s.id === finalFaseId)?.label || null
    const solucao = draftSolucao

    const payload: any = {
      id_cliente: clienteId || null,
      id_vendedor: vendedorId || null,
      id_contato: draftContatoId.trim() || null,
      id_fase: finalFaseId || null,
      id_status: finalStatusId || null,
      id_motivo: draftMotivoId || null,
      id_origem: draftOrigemId || null,
      solucao,
      qts_item,
      prev_entrega,
      cod_produto: null,
      cod_servico: null,
      ticket_valor: ticketCalculado,
      temperatura,
      obs_oport: draftObs.trim() || null,
      descricao_oport: draftDescricao.trim() || null,
      fase: faseLabel
    }

    setSaving(true)
    setFormError(null)
    try {
      if (activeId) {
        await updateOportunidade(activeId, payload)
        await replaceOportunidadeItens(
          activeId,
          draftItens.map((i) => ({
            tipo: i.tipo,
            produto_id: i.produtoId,
            servico_id: i.servicoId,
            descricao_item: i.descricao,
            quantidade: i.quantidade,
            desconto_percent: i.descontoPercent,
            valor_unitario: i.valorUnitario,
            valor_total: calcItemTotal(i)
          }))
        )
        if (comentariosDraft.length > 0) {
          for (const c of comentariosDraft) {
            await createOportunidadeComentario(activeId, c.comentario)
          }
          setComentariosDraft([])
          const rows = await fetchOportunidadeComentarios(activeId)
          setComentarios(rows)
        }
      } else {
        const created = await createOportunidade(payload)
        const newId = (created as any)?.id_oport || (created as any)?.id_oportunidade
        if (newId) {
          await replaceOportunidadeItens(
            String(newId),
            draftItens.map((i) => ({
              tipo: i.tipo,
              produto_id: i.produtoId,
              servico_id: i.servicoId,
              descricao_item: i.descricao,
              quantidade: i.quantidade,
              desconto_percent: i.descontoPercent,
              valor_unitario: i.valorUnitario,
              valor_total: calcItemTotal(i)
            }))
          )
          if (comentariosDraft.length > 0) {
            for (const c of comentariosDraft) {
              await createOportunidadeComentario(String(newId), c.comentario)
            }
            setComentariosDraft([])
          }
        }
      }
      setFormOpen(false)
      setActiveId(null)
      await loadData()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStageId = destination.droppableId
    const faseLabel = stages.find(s => s.id === newStageId)?.label || null
    
    // 1. Optimistic Update
    const originalOpportunities = [...opportunities]
    setOpportunities(prev => prev.map(op => {
      const id = (op.id_oport || (op as any).id_oportunidade)
      if (id === draggableId) {
        return { ...op, id_fase: newStageId, fase: faseLabel }
      }
      return op
    }))

    // 2. API Call
    try {
       await updateOportunidade(draggableId, { id_fase: newStageId, fase: faseLabel } as any)
    } catch (error) {
       console.error('Failed to update stage', error)
       // Rollback
       setOpportunities(originalOpportunities)
       alert('Falha ao atualizar a fase da proposta comercial.')
    }
  }, [opportunities, stages])

  // Filtragem
  const filteredOpportunities = opportunities.filter(op => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (
      (op.cliente?.toLowerCase().includes(term) || false) ||
      (op.solucao?.toLowerCase().includes(term) || false) ||
      (op.vendedor?.toLowerCase().includes(term) || false)
    )
  })

  // Agrupamento por etapa
  const stageIds = new Set(stages.map((s) => s.id))
  const defaultStageId = stages[0]?.id || FALLBACK_STAGES[0]!.id

  const columns = stages
    .slice()
    .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
    .map(stage => {
    return {
      ...stage,
      items: filteredOpportunities.filter(op => {
        // Normalização simples para garantir match
        const rawStageId = (op.id_fase || '').trim()
        if (rawStageId && stageIds.has(rawStageId)) return rawStageId === stage.id

        const label = (op.fase || '').trim()
        if (label) {
          const match = stages.find(s => s.label === label)
          if (match) return match.id === stage.id
        }

        return stage.id === defaultStageId
      })
    }
  })

  // Cálculos de totais
  const totalValue = filteredOpportunities.reduce((acc, curr) => acc + getValorNumber(curr), 0)
  const totalCount = filteredOpportunities.length

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4 animate-in fade-in duration-500">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Pipeline de Vendas</h1>
            <p className="text-xs text-slate-400">Gerencie suas propostas comerciais e negociações</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total em Pipeline</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalValue)}</span>
           </div>
           <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Propostas Comerciais</span>
              <span className="text-sm font-bold text-slate-200">{totalCount}</span>
           </div>

           <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar propostas comerciais..."
                className="pl-10 pr-4 py-2 rounded-xl bg-[#0F172A] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 w-48 transition-all"
              />
           </div>

           <button
             type="button"
             onClick={openCreate}
             className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
           >
             <Plus size={16} />
             CRIAR OPORTUNIDADE
           </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        {loading && opportunities.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-2xl border border-white/5 bg-[#0F172A]">
            <div className="flex items-center gap-3 text-slate-300">
              <Loader2 className="animate-spin text-cyan-400" size={18} />
              <span className="text-sm font-semibold">Carregando propostas comerciais...</span>
            </div>
          </div>
        ) : (
          <HorizontalScrollArea className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex h-full gap-4 min-w-[1400px] px-1">
              {columns.map(column => (
                <div key={column.id} className="flex flex-col w-80 shrink-0 h-full">
                  <div
                    className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-b-2 bg-[#0F172A] border-white/5"
                    style={{
                      borderBottomColor: column.cor ? hexToRgba(column.cor, 0.55) : undefined,
                      backgroundColor: column.cor ? hexToRgba(column.cor, 0.08) : undefined
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-black uppercase tracking-wider"
                        style={{ color: column.cor || undefined }}
                      >
                        {column.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">
                      {column.items.length}
                    </span>
                  </div>

                  <div
                    className="flex-1 rounded-xl bg-slate-900/20 border border-white/5 p-2 transition-colors"
                    style={{ backgroundColor: column.cor ? hexToRgba(column.cor, 0.05) : undefined }}
                  >
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`h-full overflow-y-auto custom-scrollbar pr-1 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5 rounded-lg' : ''}`}
                        >
                          {column.items.map((item, index) => (
                            <OpportunityCard
                              key={item.id_oport || (item as any).id_oportunidade}
                              opportunity={item}
                              index={index}
                              onOpen={openEdit}
                              clienteNome={item.id_cliente ? (clienteNameById[item.id_cliente] ?? null) : null}
                              contatoNome={item.id_contato ? (contatoNameById[item.id_contato] ?? null) : null}
                              vendedorNome={item.id_vendedor ? (vendedorNameById[item.id_vendedor] ?? null) : null}
                              vendedorAvatarUrl={item.id_vendedor ? (vendedorAvatarById[item.id_vendedor] ?? null) : null}
                            />
                          ))}
                          {provided.placeholder}

                          {column.items.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-24 opacity-30">
                              <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center mb-2">
                                <Plus size={14} className="text-slate-500" />
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">Arraste ou crie aqui</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>

                  <div className="mt-2 px-2 flex justify-between items-center opacity-60">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Total</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatCurrency(column.items.reduce((acc, i) => acc + getValorNumber(i), 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </HorizontalScrollArea>
        )}
      </DragDropContext>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          if (createSaving || createContatoSaving) return
          setCreateOpen(false)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Plus size={16} className="text-cyan-300" />
            </div>
            Criar Oportunidade
          </div>
        }
        size="lg"
        zIndex={120}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={createSaving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateOportunidade}
              disabled={createSaving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              {createSaving ? 'Criando...' : 'Criar Oportunidade'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Cliente</label>
              <div className="relative mt-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={createClienteQuery}
                  onChange={(e) => {
                    setCreateClienteQuery(e.target.value)
                    setCreateClienteId('')
                    setCreateContatoId('')
                    setCreateContatoOptions([])
                    setCreateClienteOpen(true)
                  }}
                  onFocus={() => setCreateClienteOpen(true)}
                  onBlur={() => window.setTimeout(() => setCreateClienteOpen(false), 150)}
                  placeholder="Pesquisar cliente..."
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 pl-9 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
                {createClienteOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden">
                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                      {createClienteLoading ? (
                        <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          Buscando...
                        </div>
                      ) : createClienteOptions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400">Nenhum cliente encontrado.</div>
                      ) : (
                        createClienteOptions.map((c) => (
                          <button
                            key={c.cliente_id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setCreateClienteId(c.cliente_id)
                              setCreateClienteQuery(c.cliente_nome_razao_social)
                              setCreateClienteOpen(false)
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="text-sm font-semibold text-slate-100 truncate">{c.cliente_nome_razao_social}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {(c.cliente_documento_formatado || c.cliente_documento || '-') +
                                (c.cliente_cidade ? ` · ${c.cliente_cidade}` : '') +
                                (c.cliente_uf ? `/${c.cliente_uf}` : '')}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Contato</label>
                <select
                  value={createContatoId}
                  onChange={(e) => setCreateContatoId(e.target.value)}
                  disabled={!createClienteId || createContatoLoading}
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none disabled:opacity-40"
                >
                  <option value="">{createContatoLoading ? 'Carregando...' : '-'}</option>
                  {createContatoOptions.map((c) => (
                    <option key={c.contato_id} value={c.contato_id}>
                      {c.contato_nome}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateContatoNome('')
                  setCreateContatoEmail('')
                  setCreateContatoTelefone('')
                  setCreateContatoModalOpen(true)
                }}
                disabled={!createClienteId}
                className="h-[46px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Adicionar contato
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Origem</label>
                <select
                  value={createOrigemId}
                  onChange={(e) => setCreateOrigemId(e.target.value)}
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                >
                  <option value="">-</option>
                  {origens.map((o) => (
                    <option key={o.orig_id} value={o.orig_id}>
                      {o.descricao_orig}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Vendedor</label>
                <select
                  value={createVendedorId}
                  onChange={(e) => setCreateVendedorId(e.target.value)}
                  disabled={!canCrmControl}
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                >
                  <option value="">{canCrmControl ? '-' : (myUserName || '-')}</option>
                  {!canCrmControl && myUserId && !usuarios.some((u: UsuarioSimples) => u.id === myUserId) && (
                    <option value={myUserId}>{myUserName || 'Meu usuário'}</option>
                  )}
                  {usuarios.map((u: UsuarioSimples) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Solução</label>
              <select
                value={createSolucao}
                onChange={(e) => setCreateSolucao(e.target.value as any)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="PRODUTO">Produto</option>
                <option value="SERVICO">Serviço</option>
                <option value="PRODUTO_SERVICO">Produto + Serviço</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Valor</label>
                <input
                  value={createTicket}
                  onChange={(e) => setCreateTicket(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 15000"
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Previsão de Fechamento</label>
                <input
                  type="month"
                  value={createPrevFechamento}
                  onChange={(e) => setCreatePrevFechamento(e.target.value)}
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Solicitação do Cliente</label>
              <input
                value={createSolicitacao}
                onChange={(e) => setCreateSolicitacao(e.target.value)}
                placeholder="Descreva a solicitação do cliente..."
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={createContatoModalOpen}
        onClose={() => {
          if (createContatoSaving) return
          setCreateContatoModalOpen(false)
        }}
        title="Adicionar contato"
        size="md"
        zIndex={160}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateContatoModalOpen(false)}
              disabled={createContatoSaving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                const nome = createContatoNome.trim()
                if (!createClienteId) return
                if (!nome) return
                if (createContatoSaving) return
                setCreateContatoSaving(true)
                try {
                  const created = await createClienteContato({
                    integ_id: null,
                    cliente_id: createClienteId,
                    contato_nome: nome,
                    contato_cargo: null,
                    contato_telefone01: createContatoTelefone || null,
                    contato_telefone02: null,
                    contato_email: createContatoEmail || null,
                    user_id: null,
                    contato_obs: null,
                    deleted_at: null
                  })
                  const refreshed = await fetchClienteContatos(createClienteId)
                  setCreateContatoOptions(refreshed)
                  setCreateContatoId(created.contato_id)
                  setCreateContatoModalOpen(false)
                } finally {
                  setCreateContatoSaving(false)
                }
              }}
              disabled={createContatoSaving || !createClienteId || !createContatoNome.trim()}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              {createContatoSaving ? 'Salvando...' : 'Adicionar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Nome</label>
            <input
              value={createContatoNome}
              onChange={(e) => setCreateContatoNome(e.target.value)}
              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              placeholder="Nome do contato"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Telefone</label>
              <input
                value={createContatoTelefone}
                onChange={(e) => setCreateContatoTelefone(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">E-mail</label>
              <input
                value={createContatoEmail}
                onChange={(e) => setCreateContatoEmail(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={formOpen}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          setActiveId(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <LayoutDashboard size={16} className="text-cyan-300" />
            </div>
            {activeId ? 'Editar Proposta Comercial' : 'Nova Proposta Comercial'}
          </div>
        }
        size="full"
        noPadding
      >
        <div className="min-h-full">
          {formError && (
            <div className="mx-4 mt-4 md:mx-6 md:mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              <div className="px-4 md:px-6 py-4 md:py-5 border-b border-white/10 bg-[#0B1220]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Cliente</label>
                    <div className="relative mt-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={clienteQuery}
                        onChange={(e) => {
                          setClienteQuery(e.target.value)
                          setDraftClienteId('')
                          setDraftContatoId('')
                          setContatoQuery('')
                          setClienteOpen(true)
                        }}
                        onFocus={() => setClienteOpen(true)}
                        onBlur={() => window.setTimeout(() => setClienteOpen(false), 150)}
                        placeholder="Pesquisar cliente..."
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 pl-9 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                      />
                      {clienteOpen && (
                        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            {clienteLoading ? (
                              <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={14} />
                                Buscando...
                              </div>
                            ) : clienteOptions.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-400">Nenhum cliente encontrado.</div>
                            ) : (
                              clienteOptions.map((c) => (
                                <button
                                  key={c.cliente_id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setDraftClienteId(c.cliente_id)
                                    setClienteQuery(c.cliente_nome_razao_social)
                                    setDraftContatoId('')
                                    setContatoQuery('')
                                    setClienteOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                                >
                                  <div className="text-sm font-semibold text-slate-100 truncate">
                                    {c.cliente_nome_razao_social}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {(c.cliente_documento_formatado || c.cliente_documento || '-') +
                                      (c.cliente_cidade ? ` · ${c.cliente_cidade}` : '') +
                                      (c.cliente_uf ? `/${c.cliente_uf}` : '')}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Solução</label>
                    <select
                      value={draftSolucao}
                      onChange={(e) => setDraftSolucao(e.target.value as any)}
                      className="mt-2 w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                    >
                      <option value="PRODUTO">Venda de Produto</option>
                      <option value="SERVICO">Venda de Serviço</option>
                      <option value="PRODUTO_SERVICO">Venda de Produto + Serviço</option>
                    </select>
                  </div>

                  <div className="lg:col-span-3 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Origem</label>
                    <div className="relative mt-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={origemQuery}
                        onChange={(e) => {
                          setOrigemQuery(e.target.value)
                          setDraftOrigemId('')
                          setOrigemOpen(true)
                        }}
                        onFocus={() => setOrigemOpen(true)}
                        onBlur={() => window.setTimeout(() => setOrigemOpen(false), 150)}
                        placeholder="Pesquisar origem..."
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 pl-9 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                      />
                      {origemOpen && (
                        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            {origemFiltered.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-400">Nenhuma origem encontrada.</div>
                            ) : (
                              origemFiltered.map((o) => (
                                <button
                                  key={o.orig_id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setDraftOrigemId(o.orig_id)
                                    setOrigemQuery(o.descricao_orig)
                                    setOrigemOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                                >
                                  <div className="text-sm font-semibold text-slate-100 truncate">{o.descricao_orig}</div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Contato</label>
                    <div className="relative mt-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={contatoQuery}
                        onChange={(e) => {
                          setContatoQuery(e.target.value)
                          setDraftContatoId('')
                          setContatoOpen(true)
                        }}
                        onFocus={() => setContatoOpen(true)}
                        onBlur={() => window.setTimeout(() => setContatoOpen(false), 150)}
                        disabled={!draftClienteId.trim()}
                        placeholder={draftClienteId.trim() ? 'Pesquisar contato...' : 'Selecione um cliente'}
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 pl-9 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none disabled:opacity-60"
                      />
                      {contatoOpen && draftClienteId.trim() && (
                        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            {contatoLoading ? (
                              <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                                <Loader2 className="animate-spin" size={14} />
                                Carregando...
                              </div>
                            ) : contatoFiltered.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-400">Nenhum contato encontrado.</div>
                            ) : (
                              contatoFiltered.map((c) => (
                                <button
                                  key={c.contato_id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setDraftContatoId(c.contato_id)
                                    setContatoQuery(c.contato_nome)
                                    setContatoOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                                >
                                  <div className="text-sm font-semibold text-slate-100 truncate">{c.contato_nome}</div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {(c.contato_email || '-') +
                                      (c.contato_telefone01 ? ` · ${c.contato_telefone01}` : '')}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Vendedor</label>
                    <div className="relative mt-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={vendedorQuery}
                        onChange={(e) => {
                          setVendedorQuery(e.target.value)
                          setDraftVendedorId('')
                          setVendedorOpen(true)
                        }}
                        onFocus={() => setVendedorOpen(true)}
                        onBlur={() => window.setTimeout(() => setVendedorOpen(false), 150)}
                        disabled={!canCrmControl}
                        placeholder="Pesquisar vendedor..."
                        className="w-full rounded-xl bg-[#0F172A] border border-white/10 pl-9 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                      />
                      {vendedorOpen && (
                        <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden">
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            {vendedorFiltered.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-400">Nenhum vendedor encontrado.</div>
                            ) : (
                              vendedorFiltered.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setDraftVendedorId(u.id)
                                    setVendedorQuery(u.nome)
                                    setVendedorOpen(false)
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                                >
                                  <div className="text-sm font-semibold text-slate-100 truncate">{u.nome}</div>
                                  <div className="text-[11px] text-slate-400 truncate">{u.email_corporativo || u.email_login || ''}</div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Ticket Calculado</label>
                    <input
                      value={formatCurrency(ticketCalculado)}
                      readOnly
                      className="mt-2 w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-bold text-emerald-300 outline-none font-mono"
                    />
                  </div>

                  <div className="lg:col-span-12">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Solicitação do Cliente</label>
                    <input
                      value={draftDescricao}
                      onChange={(e) => setDraftDescricao(e.target.value)}
                      placeholder="Descreva a solicitação do cliente..."
                      className="mt-2 w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-6 pt-4">
                <HorizontalScrollArea className="w-full overflow-x-auto">
                  <div className="flex gap-2 pb-2">
                    {[
                      { id: 'ticket', label: 'Ticket' },
                      { id: 'previsaoTemperatura', label: 'Previsão e Temperatura' },
                      { id: 'comentarios', label: 'Comentários' },
                      { id: 'observacoes', label: 'Observações do cliente' },
                      { id: 'historico', label: 'Histórico' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id as any)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          tab === t.id
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </HorizontalScrollArea>
              </div>

              <div className="px-4 md:px-6 py-4 pb-8">
                {tab === 'ticket' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setItemModalTipo('PRODUTO')
                          setItemSearch('')
                          setItemSelectedId('')
                          setItemQuantidade('1')
                          setItemDesconto('0')
                          setItemModalOpen(true)
                        }}
                        disabled={draftSolucao === 'SERVICO'}
                        className="w-full px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Adicionar Produto
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setItemModalTipo('SERVICO')
                          setItemSearch('')
                          setItemSelectedId('')
                          setItemQuantidade('1')
                          setItemDesconto('0')
                          setItemModalOpen(true)
                        }}
                        disabled={draftSolucao === 'PRODUTO'}
                        className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg shadow-indigo-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Adicionar Serviço
                      </button>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Calculado</div>
                        <div className="mt-1 text-lg font-black text-emerald-300 font-mono">{formatCurrency(ticketCalculado)}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Itens</div>

                      {draftItens.length === 0 ? (
                        <div className="mt-3 text-sm text-slate-400">Nenhum item adicionado.</div>
                      ) : (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-[720px] w-full text-left text-xs">
                            <thead className="text-[10px] uppercase tracking-widest text-slate-400">
                              <tr className="border-b border-white/10">
                                <th className="py-2 pr-3">Tipo</th>
                                <th className="py-2 pr-3">Item</th>
                                <th className="py-2 pr-3 w-[110px]">Qtd</th>
                                <th className="py-2 pr-3 w-[130px]">Desconto %</th>
                                <th className="py-2 pr-3 w-[140px]">Unit</th>
                                <th className="py-2 pr-3 w-[140px]">Total</th>
                                <th className="py-2 w-[56px]" />
                              </tr>
                            </thead>
                            <tbody>
                              {draftItens.map((it) => (
                                <tr key={it.localId} className="border-b border-white/5">
                                  <td className="py-3 pr-3">
                                    <span className={`px-2 py-1 rounded-lg font-black ${
                                      it.tipo === 'PRODUTO' ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                                    }`}>
                                      {it.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-3">
                                    <div className="text-slate-100 font-semibold truncate max-w-[340px]" title={it.descricao}>
                                      {it.descricao}
                                    </div>
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      value={String(it.quantidade ?? 1)}
                                      onChange={(e) => {
                                        const v = Number.parseFloat(e.target.value.replace(',', '.'))
                                        setDraftItens((prev) =>
                                          prev.map((x) => (x.localId === it.localId ? { ...x, quantidade: Number.isFinite(v) ? Math.max(0.01, v) : x.quantidade } : x))
                                        )
                                      }}
                                      inputMode="decimal"
                                      className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-3 py-2 text-slate-100 font-mono focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 outline-none"
                                    />
                                  </td>
                                  <td className="py-3 pr-3">
                                    <input
                                      value={String(it.descontoPercent ?? 0)}
                                      onChange={(e) => {
                                        const v = Number.parseFloat(e.target.value.replace(',', '.'))
                                        setDraftItens((prev) =>
                                          prev.map((x) =>
                                            x.localId === it.localId
                                              ? { ...x, descontoPercent: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : x.descontoPercent }
                                              : x
                                          )
                                        )
                                      }}
                                      inputMode="decimal"
                                      className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-3 py-2 text-slate-100 font-mono focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 outline-none"
                                    />
                                  </td>
                                  <td className="py-3 pr-3 text-slate-300 font-mono">{formatCurrency(it.valorUnitario)}</td>
                                  <td className="py-3 pr-3 text-emerald-300 font-black font-mono">{formatCurrency(calcItemTotal(it))}</td>
                                  <td className="py-3">
                                    <button
                                      type="button"
                                      onClick={() => setDraftItens((prev) => prev.filter((x) => x.localId !== it.localId))}
                                      className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
                                      aria-label="Remover item"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'previsaoTemperatura' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-300">Temperatura</div>
                          <div className="mt-1 text-[11px] text-slate-400">Escolha rápida por matriz</div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          {`${Math.min(100, Math.max(1, Number.parseInt(draftTemperatura || '50', 10) || 50))}°`}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-4">
                        <div className="flex flex-col justify-between py-2">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider rotate-180 [writing-mode:vertical-rl]">
                            Certeza de Vitória
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              [40, 80, 90],
                              [25, 60, 80],
                              [10, 25, 40]
                            ].flat().map((v, idx) => {
                              const temp = Math.min(100, Math.max(1, Number.parseInt(draftTemperatura || '50', 10) || 50))
                              const selected = temp === v
                              const isHigh = v >= 80
                              const isMid = v >= 40 && v < 80
                              const bg = isHigh ? 'bg-orange-600/90 hover:bg-orange-500' : isMid ? 'bg-orange-400/70 hover:bg-orange-400' : 'bg-orange-300/50 hover:bg-orange-300'
                              const ring = selected ? 'ring-2 ring-white/70' : 'ring-1 ring-white/10'
                              return (
                                <button
                                  key={`${v}-${idx}`}
                                  type="button"
                                  onClick={() => setDraftTemperatura(String(v))}
                                  className={`h-11 rounded-xl text-sm font-black text-white ${bg} ${ring} transition-all active:scale-[0.98]`}
                                >
                                  {`${v}°`}
                                </button>
                              )
                            })}
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10 border border-white/10">
                              <div className="h-full w-1/3 bg-orange-300/70" />
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Baixa</div>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10 border border-white/10">
                              <div className="h-full w-1/3 bg-orange-400/80" />
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Média</div>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10 border border-white/10">
                              <div className="h-full w-1/3 bg-orange-600/90" />
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Alta</div>
                          </div>

                          <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Proximidade de Conclusão</span>
                            <span className="text-slate-500">Baixa → Alta</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="rounded-2xl bg-orange-200/20 border border-orange-300/20 overflow-hidden">
                          <div className="px-4 py-3 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                const n = Number.parseInt(draftTemperatura || '50', 10) || 50
                                const next = Math.max(1, Math.min(100, n - 5))
                                setDraftTemperatura(String(next))
                              }}
                              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black transition-colors"
                            >
                              ‹
                            </button>
                            <div className="text-4xl md:text-5xl font-black text-white tracking-tight">
                              {`${Math.min(100, Math.max(1, Number.parseInt(draftTemperatura || '50', 10) || 50))}°`}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const n = Number.parseInt(draftTemperatura || '50', 10) || 50
                                const next = Math.max(1, Math.min(100, n + 5))
                                setDraftTemperatura(String(next))
                              }}
                              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black transition-colors"
                            >
                              ›
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-orange-700/90 border border-orange-500/30 overflow-hidden">
                          <div className="px-4 pt-3 text-[10px] font-black uppercase tracking-widest text-orange-100/90 text-center">
                            Previsão de Fechamento
                          </div>
                          <div className="px-4 pb-4 pt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                const base = (draftPrevEntrega || '').trim()
                                const [yy, mm] = base.split('-').map((x) => Number.parseInt(x, 10))
                                const dt = Number.isFinite(yy) && Number.isFinite(mm) ? new Date(yy, (mm || 1) - 1, 1) : new Date()
                                dt.setMonth(dt.getMonth() - 1)
                                const y = dt.getFullYear()
                                const m = String(dt.getMonth() + 1).padStart(2, '0')
                                setDraftPrevEntrega(`${y}-${m}`)
                              }}
                              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black transition-colors"
                            >
                              ‹
                            </button>
                            <div className="text-lg md:text-xl font-black text-white text-center min-w-0">
                              {(() => {
                                const base = (draftPrevEntrega || '').trim()
                                const [yy, mm] = base.split('-').map((x) => Number.parseInt(x, 10))
                                const dt = Number.isFinite(yy) && Number.isFinite(mm) ? new Date(yy, (mm || 1) - 1, 1) : new Date()
                                const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dt)
                                const label = fmt.replace(' de ', '/').replace(' ', '/')
                                return label.charAt(0).toUpperCase() + label.slice(1)
                              })()}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const base = (draftPrevEntrega || '').trim()
                                const [yy, mm] = base.split('-').map((x) => Number.parseInt(x, 10))
                                const dt = Number.isFinite(yy) && Number.isFinite(mm) ? new Date(yy, (mm || 1) - 1, 1) : new Date()
                                dt.setMonth(dt.getMonth() + 1)
                                const y = dt.getFullYear()
                                const m = String(dt.getMonth() + 1).padStart(2, '0')
                                setDraftPrevEntrega(`${y}-${m}`)
                              }}
                              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black transition-colors"
                            >
                              ›
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Atualizar um mês e ano específico
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Previsão (mês/ano)</label>
                            <input
                              type="month"
                              value={draftPrevEntrega}
                              onChange={(e) => setDraftPrevEntrega(e.target.value)}
                              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Temperatura</label>
                            <input
                              value={draftTemperatura}
                              onChange={(e) => setDraftTemperatura(e.target.value)}
                              inputMode="numeric"
                              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                              placeholder="50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'comentarios' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Comentários</div>
                      <div className="mt-3 space-y-3">
                        {(activeId ? comentarios : comentariosDraft).length === 0 ? (
                          <div className="text-sm text-slate-400">Nenhum comentário.</div>
                        ) : (
                          (activeId ? comentarios : comentariosDraft).map((c: any) => (
                            <div key={c.comentario_id || c.localId} className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
                              <div className="text-[11px] font-bold text-slate-400">
                                {new Date(c.created_at || c.createdAt).toLocaleString('pt-BR')}
                              </div>
                              <div className="mt-2 text-sm text-slate-100 whitespace-pre-wrap">{c.comentario}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

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
                            if (comentarioSaving) return
                            setComentarioSaving(true)
                            try {
                              if (activeId) {
                                await createOportunidadeComentario(activeId, text)
                                const rows = await fetchOportunidadeComentarios(activeId)
                                setComentarios(rows)
                                const acts = await fetchOportunidadeAtividades(activeId)
                                setAtividades(acts)
                              } else {
                                setComentariosDraft((prev) => [
                                  ...prev,
                                  { localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, comentario: text, createdAt: new Date().toISOString() }
                                ])
                              }
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
                  </div>
                )}

                {tab === 'historico' && (
                  <div className="space-y-4">
                    {!activeId ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                        Salve a proposta para começar o histórico de atividades.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-300">Histórico de Atividades</div>
                        <div className="mt-3 space-y-3">
                          {atividades.length === 0 ? (
                            <div className="text-sm text-slate-400">Nenhuma atividade registrada.</div>
                          ) : (
                            atividades.map((a) => {
                              const p = (a.payload || {}) as any
                              const when = new Date(a.created_at).toLocaleString('pt-BR')
                              const stageDe = p?.de ? (stageLabelById.get(String(p.de)) || String(p.de)) : null
                              const stagePara = p?.para ? (stageLabelById.get(String(p.para)) || String(p.para)) : null

                              let title = a.tipo
                              let detail: string | null = null

                              if (a.tipo === 'CRIADA') title = 'Proposta criada'
                              else if (a.tipo === 'MOVEU_KANBAN') {
                                title = 'Movida no Kanban'
                                detail = stageDe && stagePara ? `${stageDe} → ${stagePara}` : null
                              } else if (a.tipo === 'ALTEROU_VALOR') {
                                title = 'Valor alterado'
                                detail = `${formatCurrency(p?.de ?? 0)} → ${formatCurrency(p?.para ?? 0)}`
                              } else if (a.tipo === 'ALTEROU_PREVISAO') {
                                title = 'Previsão alterada'
                                detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                              } else if (a.tipo === 'ALTEROU_TEMPERATURA') {
                                title = 'Temperatura alterada'
                                detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                              } else if (a.tipo === 'ALTEROU_SOLUCAO') {
                                title = 'Solução alterada'
                                detail = `${p?.de ?? '-'} → ${p?.para ?? '-'}`
                              } else if (a.tipo === 'ALTEROU_SOLICITACAO_CLIENTE') {
                                title = 'Solicitação do cliente alterada'
                                detail = null
                              } else if (a.tipo === 'ALTEROU_OBSERVACOES') {
                                title = 'Observações alteradas'
                                detail = null
                              } else if (a.tipo === 'ITEM_ADICIONADO') {
                                title = 'Item adicionado'
                                detail = `${p?.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'} · ${p?.descricao || '-'} · Qtd ${p?.quantidade ?? 1} · Desc ${p?.desconto_percent ?? 0}% · ${formatCurrency(p?.valor_total ?? 0)}`
                              } else if (a.tipo === 'ITEM_REMOVIDO') {
                                title = 'Item removido'
                                detail = `${p?.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'} · ${p?.descricao || '-'} · Qtd ${p?.quantidade ?? 1} · Desc ${p?.desconto_percent ?? 0}% · ${formatCurrency(p?.valor_total ?? 0)}`
                              } else if (a.tipo === 'ITEM_ATUALIZADO') {
                                title = 'Item atualizado'
                                detail = `${p?.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'} · ${p?.descricao || '-'} · ${formatCurrency(p?.de?.valor_total ?? 0)} → ${formatCurrency(p?.para?.valor_total ?? 0)}`
                              } else if (a.tipo === 'COMENTARIO') {
                                title = 'Comentário'
                                detail = String(p?.comentario || '').trim() || null
                              }

                              return (
                                <div key={a.atividade_id} className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-100">{title}</div>
                                      {detail ? (
                                        <div className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">{detail}</div>
                                      ) : null}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{when}</div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'observacoes' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações do cliente</label>
                      <textarea
                        value={draftObs}
                        onChange={(e) => setDraftObs(e.target.value)}
                        className="w-full h-32 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
                        placeholder="Observações do cliente..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0B1220] px-4 md:px-6 py-4 md:py-6 lg:sticky lg:top-0 lg:self-start">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.99] inline-flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo</div>
                  <div className="mt-2 text-xs text-slate-300 space-y-1">
                    <div>{`Cliente: ${draftClienteId.trim() ? clienteQuery || '-' : '-'}`}</div>
                    <div>{`Contato: ${draftContatoId.trim() ? contatoQuery || '-' : '-'}`}</div>
                    <div>{`Vendedor: ${draftVendedorId.trim() ? vendedorQuery || '-' : '-'}`}</div>
                    <div>{`Valor Calculado: ${formatCurrency(ticketCalculado)}`}</div>
                    <div>{`Temperatura: ${Math.min(100, Math.max(1, Number.parseInt(draftTemperatura || '50', 10) || 50))}°`}</div>
                    <div>{`Previsão: ${(() => {
                      const base = (draftPrevEntrega || '').trim()
                      if (!base) return '-'
                      const [yy, mm] = base.split('-').map((x) => Number.parseInt(x, 10))
                      if (!Number.isFinite(yy) || !Number.isFinite(mm)) return base
                      const dt = new Date(yy, (mm || 1) - 1, 1)
                      const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dt)
                      const label = fmt.replace(' de ', '/').replace(' ', '/')
                      const text = label.charAt(0).toUpperCase() + label.slice(1)
                      return text
                    })()}`}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Modal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={itemModalTipo === 'PRODUTO' ? 'Adicionar Produto' : 'Adicionar Serviço'}
          size="lg"
          zIndex={200}
          footer={
            <>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!itemSelected) return
                  const qtd = Number.parseFloat(String(itemQuantidade || '1').replace(',', '.'))
                  const desc = Number.parseFloat(String(itemDesconto || '0').replace(',', '.'))
                  const quantidade = Number.isFinite(qtd) ? Math.max(0.01, qtd) : 1
                  const descontoPercent = Number.isFinite(desc) ? Math.min(100, Math.max(0, desc)) : 0

                  const next: DraftItem = {
                    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    tipo: itemSelected.tipo,
                    produtoId: itemSelected.tipo === 'PRODUTO' ? itemSelected.id : null,
                    servicoId: itemSelected.tipo === 'SERVICO' ? itemSelected.id : null,
                    descricao: itemSelected.descricao,
                    quantidade,
                    descontoPercent,
                    valorUnitario: itemSelected.valorUnitario
                  }

                  setDraftItens((prev) => [...prev, next])
                  setItemModalOpen(false)
                }}
                disabled={!itemSelected}
                className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
              >
                Adicionar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={itemModalTipo === 'PRODUTO' ? 'Pesquisar produto...' : 'Pesquisar serviço...'}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 pl-10 pr-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {itemOptions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Nenhum resultado.</div>
                ) : (
                  itemOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setItemSelectedId(opt.id)}
                      className={`w-full text-left px-4 py-3 transition-colors border-b border-white/5 ${
                        itemSelectedId === opt.id ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-100 truncate">{opt.label}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{formatCurrency(opt.valor)}</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Quantidade</label>
                <input
                  value={itemQuantidade}
                  onChange={(e) => setItemQuantidade(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Desconto (%)</label>
                <input
                  value={itemDesconto}
                  onChange={(e) => setItemDesconto(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Total</label>
                <input
                  value={(() => {
                    if (!itemSelected) return formatCurrency(0)
                    const qtd = Number.parseFloat(String(itemQuantidade || '1').replace(',', '.'))
                    const desc = Number.parseFloat(String(itemDesconto || '0').replace(',', '.'))
                    const quantidade = Number.isFinite(qtd) ? Math.max(0.01, qtd) : 1
                    const descontoPercent = Number.isFinite(desc) ? Math.min(100, Math.max(0, desc)) : 0
                    return formatCurrency(
                      calcItemTotal({
                        localId: 'preview',
                        tipo: itemSelected.tipo,
                        produtoId: itemSelected.tipo === 'PRODUTO' ? itemSelected.id : null,
                        servicoId: itemSelected.tipo === 'SERVICO' ? itemSelected.id : null,
                        descricao: itemSelected.descricao,
                        quantidade,
                        descontoPercent,
                        valorUnitario: itemSelected.valorUnitario
                      })
                    )
                  })()}
                  readOnly
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-bold text-emerald-300 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </Modal>
      </Modal>
    </div>
  )
}
