import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Calendar, 
  Clock,
  Loader2,
  Trash2,
  Pencil,
  UserPlus
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
  fetchOportunidadeById,
  fetchOportunidadeItens,
  fetchOportunidadeComentarios,
  fetchOportunidadeAtividades,
  createOportunidadeComentario,
  updateOportunidade,
  createOportunidade,
  replaceOportunidadeItens,
  deleteOportunidade
} from '@/services/crm'
import {
  fetchFinCondicoesPagamento,
  fetchFinEmpresasCorrespondentes,
  fetchFinFormasPagamento,
  FinCondicaoPagamento,
  FinEmpresaCorrespondente,
  FinFormaPagamento
} from '@/services/financeiro'
import { fetchClienteById, fetchClientes, Cliente } from '@/services/clientes'
import { fetchClienteContatos, fetchContatoById, ClienteContato, createClienteContato } from '@/services/clienteContatos'
import { HorizontalScrollArea, Modal } from '@/components/ui'
import { useUsuarios, UsuarioSimples } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'
import { downloadPropostaPdf, openPropostaPdfInNewTab, preloadPropostaPdfDeps } from '@/utils/propostaPdf'

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

const normalizeWheelDelta = (delta: number, deltaMode: number, target: HTMLElement) => {
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * target.clientHeight
  return delta
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

const formatSolucaoLabel = (solucao: string | null | undefined) => {
  const s = String(solucao || '').trim().toUpperCase()
  if (s === 'PRODUTO') return 'Venda de Produto'
  if (s === 'SERVICO') return 'Venda de Serviço'
  if (s === 'PRODUTO_SERVICO') return 'Produto + Serviço'
  return '-'
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

const calcDaysSince = (dateString: string | null) => {
  if (!dateString) return null
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - dt.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Number.isFinite(days) && days >= 0 ? days : null
}

const formatDias = (days: number | null) => {
  if (days === null) return '-'
  const d = Math.max(0, Math.floor(days))
  return `${d} dia${d === 1 ? '' : 's'}`
}

const formatTempoParado = (dateString: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  const now = new Date()
  const diffMs = Math.max(0, now.getTime() - dt.getTime())
  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  const mins = totalMinutes - days * 60 * 24 - hours * 60
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
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
    (opportunity as any).cliente_nome ||
    opportunity.cliente ||
    clienteNome ||
    (opportunity.id_cliente ? `Cliente #${String(opportunity.id_cliente).split('-')[0]}` : null) ||
    'Novo Cliente'
  const contatoLabel =
    (opportunity as any).contato_nome ||
    opportunity.nome_contato ||
    contatoNome ||
    (opportunity.id_contato ? `Contato #${String(opportunity.id_contato).split('-')[0]}` : null) ||
    null
  const vendedorLabel = ((opportunity as any).vendedor_nome || opportunity.vendedor || vendedorNome || '').trim() || null
  const temperatura = Number(opportunity.temperatura || 0) || 0
  const tempBucket =
    temperatura > 0 && temperatura <= 40 ? 'FRIO' : temperatura <= 60 ? 'MORNO' : temperatura > 0 ? 'QUENTE' : null
  const tempLevel = tempBucket === 'FRIO' ? 1 : tempBucket === 'MORNO' ? 2 : tempBucket === 'QUENTE' ? 3 : 0
  const tempColor = tempBucket === 'FRIO' ? 'bg-sky-500' : tempBucket === 'MORNO' ? 'bg-amber-500' : 'bg-rose-500'
  const diasParado =
    typeof (opportunity as any).dias_parado === 'number'
      ? (opportunity as any).dias_parado
      : calcDaysSince((opportunity as any).data_parado ?? (opportunity as any).data_alteracao ?? (opportunity as any).atualizado_em ?? null)

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2" title={clienteLabel}>
                {clienteLabel}
              </h4>
            </div>
            {cod ? (
              <span className="shrink-0 text-[10px] font-black text-slate-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                #{cod}
              </span>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">Contato: </span>
              {contatoLabel || '-'}
            </div>
            <div className="text-[11px] text-slate-400">
              <span className="text-slate-500">Solução: </span>
              {formatSolucaoLabel(opportunity.solucao)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Data de inclusão">
              <Calendar size={12} className="text-slate-500" />
              <span>{formatDate(opportunity.data_inclusao)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Parado (dias)">
              <Clock size={12} className="text-slate-500" />
              <span>{`Parado: ${formatDias(diasParado)}`}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
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
            </div>

            <div
              className="w-8 h-8 rounded-full border border-cyan-500/20 bg-cyan-900/20 overflow-hidden flex items-center justify-center text-[10px] font-black text-cyan-100"
              title={vendedorLabel || 'Vendedor'}
            >
              {vendedorAvatarUrl || (opportunity as any).vendedor_avatar_url ? (
                <img
                  src={vendedorAvatarUrl || (opportunity as any).vendedor_avatar_url}
                  alt={vendedorLabel || 'Vendedor'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(vendedorLabel || String(opportunity.id_vendedor || ''))}</span>
              )}
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
  const [origemDescById, setOrigemDescById] = useState<Record<string, string>>({})
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
  const [createEmpresaCorrespondenteId, setCreateEmpresaCorrespondenteId] = useState<string>('')
  const [createSolucao, setCreateSolucao] = useState<'PRODUTO' | 'SERVICO'>('PRODUTO')
  const [createTicket, setCreateTicket] = useState('')
  const [createPrevFechamento, setCreatePrevFechamento] = useState('')
  const [createSolicitacao, setCreateSolicitacao] = useState('')
  const [createContatoModalOpen, setCreateContatoModalOpen] = useState(false)
  const [createContatoError, setCreateContatoError] = useState<string | null>(null)
  const [createContatoDraft, setCreateContatoDraft] = useState({
    integ_id: '',
    contato_nome: '',
    contato_cargo: '',
    contato_telefone01: '',
    contato_telefone02: '',
    contato_email: '',
    contato_obs: ''
  })
  const [createContatoSaving, setCreateContatoSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [draftCod, setDraftCod] = useState('')
  const [draftVendedorId, setDraftVendedorId] = useState('')
  const [draftEmpresaCorrespondenteId, setDraftEmpresaCorrespondenteId] = useState<string>('')
  const [draftClienteId, setDraftClienteId] = useState('')
  const [draftClienteDocumento, setDraftClienteDocumento] = useState('')
  const [draftContatoId, setDraftContatoId] = useState('')
  const [draftContatoDetails, setDraftContatoDetails] = useState<ClienteContato | null>(null)
  const [draftContatoNome, setDraftContatoNome] = useState('')
  const [draftContatoCargo, setDraftContatoCargo] = useState('')
  const [draftContatoTelefone01, setDraftContatoTelefone01] = useState('')
  const [draftContatoTelefone02, setDraftContatoTelefone02] = useState('')
  const [draftContatoEmail, setDraftContatoEmail] = useState('')
  const [snapshotContatoFromId, setSnapshotContatoFromId] = useState<string | null>(null)
  const [draftFaseId, setDraftFaseId] = useState('')
  const [draftStatusId, setDraftStatusId] = useState('')
  const [baselineStatusId, setBaselineStatusId] = useState<string | null>(null)
  const [draftMotivoId, setDraftMotivoId] = useState('')
  const [draftOrigemId, setDraftOrigemId] = useState('')
  const [draftSolucao, setDraftSolucao] = useState<'PRODUTO' | 'SERVICO' | 'PRODUTO_SERVICO'>('PRODUTO')
  const [draftTicket, setDraftTicket] = useState('')
  const [draftTemperatura, setDraftTemperatura] = useState('50')
  const [draftQtd, setDraftQtd] = useState('1')
  const [draftPrevEntrega, setDraftPrevEntrega] = useState('')
  const [draftFormaPagamentoId, setDraftFormaPagamentoId] = useState('')
  const [draftCondicaoPagamentoId, setDraftCondicaoPagamentoId] = useState('')
  const [draftDescontoPropostaPercent, setDraftDescontoPropostaPercent] = useState('0')
  const [draftTipoFrete, setDraftTipoFrete] = useState<'FOB' | 'CIF' | ''>('')
  const [draftProdutoId, setDraftProdutoId] = useState('')
  const [draftServicoId, setDraftServicoId] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftPedidoCompraNumero, setDraftPedidoCompraNumero] = useState('')
  const [draftPedidoCompraPath, setDraftPedidoCompraPath] = useState('')
  const [pedidoCompraUploading, setPedidoCompraUploading] = useState(false)
  const [pedidoCompraError, setPedidoCompraError] = useState<string | null>(null)
  const [draftItens, setDraftItens] = useState<DraftItem[]>([])
  const [tab, setTab] = useState<
    'ticket' | 'previsao' | 'temperatura' | 'comentarios' | 'observacoes' | 'transportadores' | 'historicos'
  >('ticket')
  const pedidoCompraInputRef = useRef<HTMLInputElement | null>(null)

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemModalTipo, setItemModalTipo] = useState<'PRODUTO' | 'SERVICO'>('PRODUTO')
  const [itemSearch, setItemSearch] = useState('')
  const [itemSelectedId, setItemSelectedId] = useState<string>('')
  const [itemQuantidade, setItemQuantidade] = useState('1')
  const [itemDesconto, setItemDesconto] = useState('0')

  const [statusObsOpen, setStatusObsOpen] = useState(false)
  const [statusObsText, setStatusObsText] = useState('')
  const [statusObsError, setStatusObsError] = useState<string | null>(null)

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferVendedorId, setTransferVendedorId] = useState('')
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  const [statusChangeOpen, setStatusChangeOpen] = useState(false)
  const [statusChangeId, setStatusChangeId] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateValidade, setGenerateValidade] = useState('')
  const [generateTipoFrete, setGenerateTipoFrete] = useState<'FOB' | 'CIF' | ''>('')
  const [generateValoresMode, setGenerateValoresMode] = useState<'COM' | 'SEM'>('COM')
  const [generatePdfLoading, setGeneratePdfLoading] = useState(false)
  const [generatePdfError, setGeneratePdfError] = useState<string | null>(null)

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

  const active = useMemo(() => {
    const target = String(activeId || '').trim()
    if (!target) return null
    return (
      opportunities.find((o) => {
        const id = String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim()
        return id === target
      }) || null
    )
  }, [opportunities, activeId])

  const { session, profile, can, isAdmin } = useAuth()
  const canCrmControl = can('CRM', 'CONTROL')
  const myUserId = (profile?.id || session?.user?.id || '').trim()
  const myUserName = (profile?.nome || '').trim()

  const [formasPagamento, setFormasPagamento] = useState<FinFormaPagamento[]>([])
  const [condicoesPagamento, setCondicoesPagamento] = useState<FinCondicaoPagamento[]>([])
  const [empresasCorrespondentes, setEmpresasCorrespondentes] = useState<FinEmpresaCorrespondente[]>([])
  const [paymentsSchemaOk, setPaymentsSchemaOk] = useState<boolean | null>(null)

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

  const defaultEmpresaCorrespondenteId = useMemo(() => {
    if (empresasCorrespondentes.length === 0) return ''
    const apl = empresasCorrespondentes.find((e) => String(e.nome_fantasia || '').trim().toLowerCase() === 'apliflow')
    return String(apl?.empresa_id || empresasCorrespondentes[0]?.empresa_id || '').trim()
  }, [empresasCorrespondentes])

  const empresaNomeById = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of empresasCorrespondentes) {
      const id = String(e.empresa_id || '').trim()
      if (!id) continue
      const label = String(e.nome_fantasia || e.razao_social || '').trim() || 'Empresa'
      m.set(id, label)
    }
    return m
  }, [empresasCorrespondentes])

  useEffect(() => {
    Promise.all([fetchFinFormasPagamento(), fetchFinCondicoesPagamento(), fetchFinEmpresasCorrespondentes()])
      .then(([formas, conds, empresas]) => {
        setFormasPagamento(formas)
        setCondicoesPagamento(conds)
        setEmpresasCorrespondentes(empresas)
      })
      .catch(() => {
        setFormasPagamento([])
        setCondicoesPagamento([])
        setEmpresasCorrespondentes([])
      })
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [data, fases, sts] = await Promise.all([fetchOportunidades({ orderDesc: true }), fetchCrmFases(), fetchCrmStatus()])
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
      setStatuses(sts)
      const nextData =
        !canCrmControl && myUserId
          ? (data || []).filter((o) => {
              const createdBy = String((o as any)?.created_by || '').trim()
              const vendedorId = String((o as any)?.id_vendedor || '').trim()
              return createdBy === myUserId || vendedorId === myUserId
            })
          : data
      setOpportunities(nextData)
      try {
        const probe = await (supabase as any).from('crm_oportunidades').select('forma_pagamento_id, condicao_pagamento_id').limit(1)
        if (!probe?.error) {
          setPaymentsSchemaOk(true)
        } else {
          const code = String(probe.error?.code || '')
          const msg = String(probe.error?.message || '')
          const lc = msg.toLowerCase()
          const missing =
            code === 'PGRST204' ||
            code === '42703' ||
            (lc.includes('schema cache') && lc.includes('column')) ||
            (lc.includes('could not find') && lc.includes('column'))
          setPaymentsSchemaOk(missing ? false : true)
        }
      } catch {
        setPaymentsSchemaOk(false)
      }
      try {
        const clienteIdsSet = new Set<string>()
        const contatoIdsSet = new Set<string>()
        const origemIdsSet = new Set<string>()

        for (const o of nextData || []) {
          const clienteId = String((o as any)?.id_cliente || (o as any)?.cliente_id || '').trim()
          if (clienteId) clienteIdsSet.add(clienteId)
          const contatoId = String((o as any)?.id_contato || (o as any)?.contato_id || '').trim()
          if (contatoId) contatoIdsSet.add(contatoId)
          const origemId = String((o as any)?.id_origem || (o as any)?.orig_id || '').trim()
          if (origemId) origemIdsSet.add(origemId)
        }

        const chunk = <T,>(items: T[], size: number) => {
          const out: T[][] = []
          for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
          return out
        }

        const clienteIds = Array.from(clienteIdsSet)
        const contatoIds = Array.from(contatoIdsSet)
        const origemIds = Array.from(origemIdsSet)

        if (clienteIds.length === 0) setClienteNameById({})
        else {
          const map: Record<string, string> = {}
          for (const ids of chunk(clienteIds, 250)) {
            const { data: rows, error } = await (supabase as any)
              .from('crm_clientes')
              .select('cliente_id, cliente_nome_razao_social, deleted_at')
              .in('cliente_id', ids)
              .is('deleted_at', null)
            if (error) continue
            for (const r of rows || []) {
              if (r?.cliente_id && r?.cliente_nome_razao_social) map[String(r.cliente_id)] = String(r.cliente_nome_razao_social)
            }
          }
          setClienteNameById(map)
        }

        if (contatoIds.length === 0) setContatoNameById({})
        else {
          const map: Record<string, string> = {}
          for (const ids of chunk(contatoIds, 250)) {
            const { data: rows, error } = await (supabase as any)
              .from('crm_contatos')
              .select('contato_id, contato_nome, deleted_at')
              .in('contato_id', ids)
              .is('deleted_at', null)
            if (error) continue
            for (const r of rows || []) {
              if (r?.contato_id && r?.contato_nome) map[String(r.contato_id)] = String(r.contato_nome)
            }
          }
          setContatoNameById(map)
        }

        if (origemIds.length === 0) setOrigemDescById({})
        else {
          const map: Record<string, string> = {}
          for (const ids of chunk(origemIds, 250)) {
            const { data: rows, error } = await (supabase as any)
              .from('crm_origem_leads')
              .select('orig_id, descricao_orig')
              .in('orig_id', ids)
            if (error) continue
            for (const r of rows || []) {
              if (r?.orig_id && r?.descricao_orig) map[String(r.orig_id)] = String(r.descricao_orig)
            }
          }
          setOrigemDescById(map)
        }
      } catch {
        setClienteNameById({})
        setContatoNameById({})
        setOrigemDescById({})
      }
    } catch (error) {
      console.error('Failed to load opportunities', error)
    } finally {
      setLoading(false)
    }
  }, [canCrmControl, myUserId])

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
      const clienteId = String((active as any).id_cliente || (active as any).cliente_id || '').trim()
      const contatoId = String((active as any).id_contato || (active as any).contato_id || '').trim()
      setDraftCod(active.cod_oport || active.cod_oportunidade || '')
      setDraftVendedorId(active.id_vendedor || '')
      setDraftClienteId(clienteId)
      setDraftContatoId(contatoId)
      setDraftContatoDetails(null)
      setDraftClienteDocumento('')
      setDraftContatoNome('')
      setDraftContatoCargo('')
      setDraftContatoTelefone01('')
      setDraftContatoTelefone02('')
      setDraftContatoEmail('')
      const snapClienteDoc = String((active as any).cliente_documento || '').trim()
      if (snapClienteDoc) setDraftClienteDocumento(snapClienteDoc)
      const snapContatoNome =
        String((active as any).contato_nome || active.nome_contato || '').trim() ||
        (contatoId ? String(contatoNameById[contatoId] || '').trim() : '')
      const snapContatoCargo = String((active as any).contato_cargo || '').trim()
      const snapContatoTel1 = String((active as any).contato_telefone01 || active.telefone01_contato || '').trim()
      const snapContatoTel2 = String((active as any).contato_telefone02 || active.telefone02_contato || '').trim()
      const snapContatoEmail = String((active as any).contato_email || active.email || '').trim()
      if (snapContatoNome) setDraftContatoNome(snapContatoNome)
      if (snapContatoCargo) setDraftContatoCargo(snapContatoCargo)
      if (snapContatoTel1) setDraftContatoTelefone01(snapContatoTel1)
      if (snapContatoTel2) setDraftContatoTelefone02(snapContatoTel2)
      if (snapContatoEmail) setDraftContatoEmail(snapContatoEmail)
      setSnapshotContatoFromId(null)
      setDraftEmpresaCorrespondenteId(
        String((active as any).empresa_correspondente_id || '').trim() ||
          defaultEmpresaCorrespondenteId
      )
      setDraftFaseId(active.id_fase || '')
      setDraftStatusId(active.id_status || '')
      setBaselineStatusId(active.id_status || null)
      setDraftMotivoId(active.id_motivo || '')
      setDraftOrigemId((active as any).id_origem || (active as any).orig_id || '')
      const solucao = (active.solucao as any) || 'PRODUTO'
      setDraftSolucao(solucao)
      if (solucao === 'PRODUTO_SERVICO') {
        setFormError(
          'Esta proposta está como Produto + Serviço (modelo antigo). A partir de agora, crie duas propostas separadas: Venda de Produto e Venda de Serviço.'
        )
      }
      setDraftTicket(active.ticket_valor === null || active.ticket_valor === undefined ? '' : String(active.ticket_valor))
      setDraftTemperatura(active.temperatura === null || active.temperatura === undefined ? '50' : String(active.temperatura))
      setDraftQtd(active.qts_item === null || active.qts_item === undefined ? '1' : String(active.qts_item))
      setDraftPrevEntrega(active.prev_entrega ? String(active.prev_entrega).slice(0, 10) : '')
      setDraftFormaPagamentoId(String((active as any).forma_pagamento_id || ''))
      setDraftCondicaoPagamentoId(String((active as any).condicao_pagamento_id || ''))
      {
        const v = (active as any).desconto_percent_proposta
        setDraftDescontoPropostaPercent(v === null || v === undefined ? '0' : String(v))
      }
      setDraftTipoFrete(((active as any).tipo_frete as any) || '')
      setDraftProdutoId(active.cod_produto || '')
      setDraftServicoId(active.cod_servico || '')
      setDraftObs(active.obs_oport || '')
      setDraftDescricao(active.descricao_oport || '')
      setDraftPedidoCompraNumero(String((active as any).pedido_compra_numero || '').trim())
      setDraftPedidoCompraPath(String((active as any).pedido_compra_path || '').trim())
      setPedidoCompraError(null)
      setPedidoCompraUploading(false)
      setDraftItens([])

      const snapClienteNome =
        String((active as any).cliente_nome || active.cliente || '').trim() ||
        (clienteId ? String(clienteNameById[clienteId] || '').trim() : '')
      setClienteQuery(snapClienteNome || '')
      setContatoQuery(snapContatoNome || '')
      setVendedorQuery(String((active as any).vendedor_nome || active.vendedor || '').trim())
      setOrigemQuery('')
      setComentarios([])
      setComentariosDraft([])
      setComentarioTexto('')
      setAtividades([])
    } else if (!activeId) {
      setDraftCod('')
      setDraftVendedorId(canCrmControl ? '' : myUserId)
      setDraftClienteId('')
      setDraftContatoId('')
      setDraftContatoDetails(null)
      setDraftClienteDocumento('')
      setDraftContatoNome('')
      setDraftContatoCargo('')
      setDraftContatoTelefone01('')
      setDraftContatoTelefone02('')
      setDraftContatoEmail('')
      setSnapshotContatoFromId(null)
      setDraftEmpresaCorrespondenteId(defaultEmpresaCorrespondenteId)
      setDraftFaseId(leadStageId || '')
      setDraftStatusId(andamentoStatusId || '')
      setBaselineStatusId(andamentoStatusId || null)
      setDraftMotivoId('')
      setDraftOrigemId('')
      setDraftSolucao('PRODUTO')
      setDraftTicket('')
      setDraftTemperatura('50')
      setDraftQtd('1')
      {
        const now = new Date()
        setDraftPrevEntrega(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        )
      }
      setDraftFormaPagamentoId('')
      setDraftCondicaoPagamentoId('')
      setDraftDescontoPropostaPercent('0')
      setDraftTipoFrete('')
      setDraftProdutoId('')
      setDraftServicoId('')
      setDraftObs('')
      setDraftDescricao('')
      setDraftPedidoCompraNumero('')
      setDraftPedidoCompraPath('')
      setDraftPedidoCompraPath('')
      setPedidoCompraError(null)
      setPedidoCompraUploading(false)
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
  }, [formOpen, active, stages, leadStageId, andamentoStatusId, clienteNameById, contatoNameById])

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
    if (!baselineStatusId && draftStatusId) setBaselineStatusId(draftStatusId)
  }, [formOpen, baselineStatusId, draftStatusId])

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
      setDraftContatoDetails(null)
      return
    }
    let cancelled = false
    setContatoLoading(true)
    fetchClienteContatos(clienteId)
      .then((data) => {
        if (cancelled) return
        setContatoOptions(data)
      })
      .catch(() => {
        if (cancelled) return
        setContatoOptions([])
      })
      .finally(() => {
        if (cancelled) return
        setContatoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [formOpen, draftClienteId])

  useEffect(() => {
    if (!formOpen) return
    const id = draftClienteId.trim()
    if (!id) {
      setDraftClienteDocumento('')
      return
    }
    let cancelled = false
    ;(async () => {
      const c = await fetchClienteById(id)
      if (cancelled) return
      setDraftClienteDocumento(String((c as any)?.cliente_documento_formatado || (c as any)?.cliente_documento || ''))
      if (c?.cliente_nome_razao_social) {
        setClienteQuery((prev) => (prev.trim() ? prev : c.cliente_nome_razao_social))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formOpen, draftClienteId])

  useEffect(() => {
    if (!formOpen) return
    const id = draftContatoId.trim()
    if (!id) {
      setSnapshotContatoFromId(null)
      setDraftContatoDetails(null)
      setDraftContatoNome('')
      setDraftContatoCargo('')
      setDraftContatoTelefone01('')
      setDraftContatoTelefone02('')
      setDraftContatoEmail('')
      return
    }
    if (snapshotContatoFromId === id && draftContatoNome.trim()) return
    const c =
      contatoOptions.find((x) => x.contato_id === id) ||
      (draftContatoDetails?.contato_id === id ? draftContatoDetails : null) ||
      null
    if (c) {
      setDraftContatoDetails(c)
      setDraftContatoNome(String(c.contato_nome || ''))
      setDraftContatoCargo(String(c.contato_cargo || ''))
      setDraftContatoTelefone01(String(c.contato_telefone01 || ''))
      setDraftContatoTelefone02(String(c.contato_telefone02 || ''))
      setDraftContatoEmail(String(c.contato_email || ''))
      if (!contatoQuery.trim() && c.contato_nome) setContatoQuery(c.contato_nome)
      setSnapshotContatoFromId(id)
      return
    }
    let cancelled = false
    ;(async () => {
      const fetched = await fetchContatoById(id)
      if (cancelled) return
      if (!fetched) {
        setDraftContatoDetails(null)
        return
      }
      setDraftContatoDetails(fetched)
      setDraftContatoNome(String(fetched.contato_nome || ''))
      setDraftContatoCargo(String(fetched.contato_cargo || ''))
      setDraftContatoTelefone01(String(fetched.contato_telefone01 || ''))
      setDraftContatoTelefone02(String(fetched.contato_telefone02 || ''))
      setDraftContatoEmail(String(fetched.contato_email || ''))
      if (!contatoQuery.trim() && fetched.contato_nome) setContatoQuery(fetched.contato_nome)
      setSnapshotContatoFromId(id)
    })().catch(() => {
      if (cancelled) return
      setDraftContatoDetails(null)
    })
    return () => {
      cancelled = true
    }
  }, [formOpen, draftContatoId, contatoOptions, draftContatoDetails, snapshotContatoFromId, draftContatoNome, contatoQuery])

  useEffect(() => {
    if (!formOpen) return
    const id = draftOrigemId.trim()
    if (!id) return
    if (origemQuery.trim()) return
    const cached = origemDescById[id]
    if (cached) {
      setOrigemQuery(cached)
      return
    }
    const label = origens.find((o) => o.orig_id === id)?.descricao_orig
    if (label) {
      setOrigemQuery(label)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await (supabase as any)
        .from('crm_origem_leads')
        .select('descricao_orig')
        .eq('orig_id', id)
        .maybeSingle()
      if (cancelled) return
      if (error) return
      const desc = String((data as any)?.descricao_orig || '').trim()
      if (desc) setOrigemQuery(desc)
    })()
    return () => {
      cancelled = true
    }
  }, [formOpen, draftOrigemId, origens, origemQuery, origemDescById])

  useEffect(() => {
    if (!formOpen) return
    const id = draftVendedorId.trim()
    if (!id) return
    if (vendedorQuery.trim()) return
    const label = usuarios.find((u) => u.id === id)?.nome
    if (label) setVendedorQuery(label)
  }, [formOpen, draftVendedorId, usuarios, vendedorQuery])

  useEffect(() => {
    if (!formOpen) return
    const id = draftContatoId.trim()
    if (!id) return
    if (contatoQuery.trim()) return
    const label = contatoOptions.find((c) => c.contato_id === id)?.contato_nome
    if (label) setContatoQuery(label)
  }, [formOpen, draftContatoId, contatoOptions, contatoQuery])

  const dataInclusao = active?.data_inclusao ?? (active as any)?.criado_em ?? null
  const dataAlteracao = (active as any)?.data_parado ?? active?.data_alteracao ?? (active as any)?.atualizado_em ?? null
  const diasParado =
    typeof (active as any)?.dias_parado === 'number' ? (active as any).dias_parado : calcDaysSince(dataAlteracao)
  const vendedorAvatarUrl = draftVendedorId.trim() ? (vendedorAvatarById[draftVendedorId.trim()] || null) : null
  const vendedorDetails = useMemo(() => {
    const id = draftVendedorId.trim()
    if (!id) return null
    return (usuarios as any[]).find((u) => String(u.id).trim() === id) || null
  }, [usuarios, draftVendedorId])
  const vendedorTelefone = String((vendedorDetails as any)?.telefone || '').trim()
  const vendedorEmail = String((vendedorDetails as any)?.email_corporativo || (vendedorDetails as any)?.email_login || '').trim()
  const vendedorRamal = String((vendedorDetails as any)?.ramal || '').trim()
  const solucaoLabel =
    draftSolucao === 'PRODUTO' ? 'Venda de Produto' : draftSolucao === 'SERVICO' ? 'Venda de Serviço' : 'Produto + Serviço'
  const dataInclusaoLabel = formatDate(dataInclusao)
  const dataParadoLabel = formatTempoParado(dataAlteracao)

  const descontoPropostaPercent = useMemo(() => {
    const raw = String(draftDescontoPropostaPercent || '').trim().replace(',', '.')
    const v = raw ? Number.parseFloat(raw) : 0
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0
  }, [draftDescontoPropostaPercent])

  const ticketCalculadoBruto = useMemo(() => {
    const total = (draftItens || []).reduce((acc, item) => acc + calcItemTotal(item), 0)
    return Number.isFinite(total) ? total : 0
  }, [draftItens])

  const ticketCalculado = useMemo(() => {
    const factor = 1 - descontoPropostaPercent / 100
    const total = ticketCalculadoBruto * factor
    return Number.isFinite(total) ? total : 0
  }, [ticketCalculadoBruto, descontoPropostaPercent])

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
    setCreateEmpresaCorrespondenteId(defaultEmpresaCorrespondenteId)
    setCreateSolucao('PRODUTO')
    setCreateTicket('')
    setCreatePrevFechamento('')
    setCreateSolicitacao('')
    setCreateContatoError(null)
    setCreateContatoDraft({
      integ_id: '',
      contato_nome: '',
      contato_cargo: '',
      contato_telefone01: '',
      contato_telefone02: '',
      contato_email: '',
      contato_obs: ''
    })
    setCreateContatoModalOpen(false)
    setCreateOpen(true)
  }

  const openEdit = (id: string) => {
    setActiveId(String(id || '').trim())
    setFormOpen(true)
  }

  useEffect(() => {
    if (!formOpen) return
    const id = String(activeId || '').trim()
    if (!id) return
    if (active) return
    let cancelled = false
    ;(async () => {
      try {
        const fetched = await fetchOportunidadeById(id)
        if (cancelled) return
        if (!fetched) return
        setOpportunities((prev) => {
          const next = prev.slice()
          const idx = next.findIndex((o) => String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim() === id)
          if (idx >= 0) next[idx] = { ...(next[idx] as any), ...(fetched as any) }
          else next.unshift(fetched as any)
          return next
        })
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [formOpen, activeId, active])

  const handleCreateOportunidade = async () => {
    const clienteId = createClienteId.trim()
    const contatoId = createContatoId.trim()
    const origemId = createOrigemId.trim()
    const vendedorId = (canCrmControl ? createVendedorId : myUserId).trim()
    const ticketValor = parseMoney(createTicket)
    const prevEntrega = createPrevFechamento.trim() ? `${createPrevFechamento.trim()}-01` : null
    const solicitacao = createSolicitacao.trim()
    const empresaId = (createEmpresaCorrespondenteId || '').trim() || defaultEmpresaCorrespondenteId
    const empresaNome = (empresaNomeById.get(empresaId) || '').trim() || 'Apliflow'

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
    if (!empresaId) {
      setCreateError('Selecione a empresa correspondente.')
      return
    }
    if (createTicket.trim() && (!Number.isFinite(ticketValor) || (ticketValor as number) <= 0)) {
      setCreateError('Valor inválido. Use um número maior que 0, ou deixe em branco.')
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
      const cliente = await fetchClienteById(clienteId)
      const contato = createContatoOptions.find((c) => c.contato_id === contatoId) || (await fetchContatoById(contatoId))
      const clienteNomeSnapshot = (cliente?.cliente_nome_razao_social || createClienteQuery.trim() || null) as string | null
      const clienteDocSnapshot = (cliente?.cliente_documento_formatado || cliente?.cliente_documento || null) as string | null

      const created = await createOportunidade({
        id_cliente: clienteId,
        id_contato: contatoId,
        id_origem: origemId,
        id_vendedor: vendedorId,
        cliente_nome: clienteNomeSnapshot,
        cliente_documento: clienteDocSnapshot,
        contato_nome: contato?.contato_nome || null,
        contato_cargo: contato?.contato_cargo || null,
        contato_telefone01: contato?.contato_telefone01 || null,
        contato_telefone02: contato?.contato_telefone02 || null,
        contato_email: contato?.contato_email || null,
        id_fase: faseId,
        id_status: statusId,
        id_motivo: null,
        empresa_correspondente_id: empresaId,
        empresa_correspondente: empresaNome,
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
      const createdId = String((created as any)?.id_oport || (created as any)?.id_oportunidade || '').trim()
      setOpportunities((prev) => {
        const enriched: any = {
          ...(created as any),
          cliente_nome: clienteNomeSnapshot,
          cliente_documento: clienteDocSnapshot,
          contato_nome: (contato as any)?.contato_nome || null,
          contato_cargo: (contato as any)?.contato_cargo || null,
          contato_telefone01: (contato as any)?.contato_telefone01 || null,
          contato_telefone02: (contato as any)?.contato_telefone02 || null,
          contato_email: (contato as any)?.contato_email || null,
          cliente: clienteNomeSnapshot || (createClienteQuery || '').trim() || (created as any)?.cliente || null,
          nome_contato: (contato?.contato_nome || null) || (created as any)?.nome_contato || null,
          telefone01_contato: (contato?.contato_telefone01 || null) || (created as any)?.telefone01_contato || null,
          telefone02_contato: (contato?.contato_telefone02 || null) || (created as any)?.telefone02_contato || null,
          email: (contato?.contato_email || null) || (created as any)?.email || null,
          vendedor: (vendedorNameById[vendedorId] || myUserName || '').trim() || (created as any)?.vendedor || null
        }
        if (!createdId) return prev
        if (prev.some((p) => (p.id_oport || (p as any).id_oportunidade) === createdId)) return prev
        return [enriched as any, ...prev]
      })
      if (createdId) {
        setClienteQuery(clienteNomeSnapshot || '')
        setDraftClienteId(clienteId)
        setDraftClienteDocumento(clienteDocSnapshot || '')
        setDraftContatoId(contatoId)
        setDraftContatoNome(((contato as any)?.contato_nome as any) || '')
        setDraftContatoCargo(((contato as any)?.contato_cargo as any) || '')
        setDraftContatoTelefone01(((contato as any)?.contato_telefone01 as any) || '')
        setDraftContatoTelefone02(((contato as any)?.contato_telefone02 as any) || '')
        setDraftContatoEmail(((contato as any)?.contato_email as any) || '')
        setActiveId(createdId)
        setFormOpen(true)
      }
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

  const handleSave = async (opts?: { skipStatusObsCheck?: boolean; statusObs?: string | null; statusIdOverride?: string | null }) => {
    const clienteId = draftClienteId.trim()
    const vendedorId = (canCrmControl ? draftVendedorId : (myUserId || draftVendedorId)).trim()
    const lockedClienteId = activeId ? ((active?.id_cliente || clienteId).trim()) : clienteId
    const lockedVendedorId = activeId ? ((active?.id_vendedor || vendedorId).trim()) : vendedorId
    if (!lockedClienteId) {
      setFormError('Selecione um cliente.')
      return
    }
    if (!lockedVendedorId) {
      setFormError('Selecione um vendedor.')
      return
    }

    const temp = Number.parseInt(draftTemperatura, 10)
    const temperatura = Number.isFinite(temp) ? Math.min(100, Math.max(1, temp)) : null
    const qts_item = draftItens.length
      ? draftItens.reduce((acc, it) => acc + (Number(it.quantidade || 0) || 0), 0)
      : null
    const prev_entrega = draftPrevEntrega.trim() || null
    const finalFaseId = activeId ? draftFaseId : (leadStageId || draftFaseId)
    const finalStatusId = (opts?.statusIdOverride || '').trim() || draftStatusId || andamentoStatusId || ''
    const faseLabel = stages.find(s => s.id === finalFaseId)?.label || null
    const solucao = draftSolucao
    const empresaId = (draftEmpresaCorrespondenteId || '').trim() || defaultEmpresaCorrespondenteId
    const empresaNome = (empresaNomeById.get(empresaId) || '').trim() || 'Apliflow'

    if (
      paymentsSchemaOk === false &&
      (draftFormaPagamentoId.trim() || draftCondicaoPagamentoId.trim() || descontoPropostaPercent > 0)
    ) {
      setFormError(
        'Pagamentos não estão disponíveis no banco agora (API do Supabase sem a coluna condicao_pagamento_id no schema cache). Aplique as migrations do CRM e recarregue o schema do Supabase/PostgREST.'
      )
      return
    }
    if (!empresaId) {
      setFormError('Selecione a empresa correspondente.')
      return
    }

    const payload: any = {
      id_cliente: lockedClienteId || null,
      id_vendedor: lockedVendedorId || null,
      id_contato: draftContatoId.trim() || null,
      cliente_nome: (clienteQuery || '').trim() || null,
      cliente_documento: draftClienteDocumento.trim() || null,
      contato_nome: draftContatoNome.trim() || null,
      contato_cargo: draftContatoCargo.trim() || null,
      contato_telefone01: draftContatoTelefone01.trim() || null,
      contato_telefone02: draftContatoTelefone02.trim() || null,
      contato_email: draftContatoEmail.trim() || null,
      id_fase: finalFaseId || null,
      id_status: finalStatusId || null,
      id_motivo: draftMotivoId || null,
      id_origem: draftOrigemId || null,
      empresa_correspondente_id: empresaId,
      empresa_correspondente: empresaNome,
      solucao,
      qts_item,
      prev_entrega,
      pedido_compra_numero: draftPedidoCompraNumero.trim() || null,
      pedido_compra_path: draftPedidoCompraPath.trim() || null,
      cod_produto: null,
      cod_servico: null,
      ticket_valor: ticketCalculado,
      temperatura,
      obs_oport: draftObs.trim() || null,
      descricao_oport: draftDescricao.trim() || null,
      fase: faseLabel
    }
    if (paymentsSchemaOk !== false) {
      payload.forma_pagamento_id = draftFormaPagamentoId.trim() || null
      payload.condicao_pagamento_id = draftCondicaoPagamentoId.trim() || null
      payload.tipo_frete = draftTipoFrete || null
      payload.desconto_percent_proposta = descontoPropostaPercent
    }

    const baseline = (baselineStatusId || '').trim()
    const next = (finalStatusId || '').trim()
    const statusChanged = !!baseline && !!next && baseline !== next
    const statusObs = (opts?.statusObs || '').trim()
    if (statusChanged && !opts?.skipStatusObsCheck) {
      setStatusObsError(null)
      setStatusObsText('')
      setStatusObsOpen(true)
      return
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
        if (statusChanged && statusObs) {
          const fromDesc = statuses.find((s) => s.status_id === baseline)?.status_desc || '—'
          const toDesc = statuses.find((s) => s.status_id === next)?.status_desc || '—'
          await createOportunidadeComentario(activeId, `Status alterado: ${fromDesc} → ${toDesc}\nObs: ${statusObs}`)
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
          if (statusChanged && statusObs) {
            const fromDesc = statuses.find((s) => s.status_id === baseline)?.status_desc || '—'
            const toDesc = statuses.find((s) => s.status_id === next)?.status_desc || '—'
            await createOportunidadeComentario(String(newId), `Status alterado: ${fromDesc} → ${toDesc}\nObs: ${statusObs}`)
          }
        }
      }
      if (statusChanged) setBaselineStatusId(next)
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
    const solucaoLabel = formatSolucaoLabel(op.solucao).toLowerCase()
    return (
      (op.cliente?.toLowerCase().includes(term) || false) ||
      solucaoLabel.includes(term) ||
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

  const onKanbanWheelCapture = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return
    if (e.ctrlKey) return

    const rawTarget = e.target as HTMLElement | null
    if (!rawTarget) return

    const board = e.currentTarget as HTMLElement | null
    const cardsDirect = rawTarget.closest('[data-kanban-cards="1"]') as HTMLElement | null
    const col = rawTarget.closest('[data-kanban-col="1"]') as HTMLElement | null
    const cards = cardsDirect || (col ? (col.querySelector('[data-kanban-cards="1"]') as HTMLElement | null) : null)

    const absX = Math.abs(e.deltaX)
    const absY = Math.abs(e.deltaY)
    if (absX > absY) {
      if (!board) return
      if (board.scrollWidth <= board.clientWidth) return
      if (e.deltaX === 0) return
      e.preventDefault()
      board.scrollLeft += normalizeWheelDelta(e.deltaX, e.deltaMode, board)
      return
    }

    if (!cards) return
    if (cards.scrollHeight <= cards.clientHeight) return
    if (e.deltaY === 0) return
    e.preventDefault()
    cards.scrollTop += normalizeWheelDelta(e.deltaY, e.deltaMode, cards)
  }, [])

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
          <div className="flex-1 min-h-0 overflow-x-hidden">
            <div
              className="h-full overflow-x-scroll overflow-y-hidden pb-2 kanban-x-scrollbar touch-pan-y"
              onWheelCapture={onKanbanWheelCapture}
            >
              <div className="flex h-full gap-4 min-w-[1400px] px-1">
                {columns.map(column => (
                  <div key={column.id} className="flex flex-col w-80 shrink-0 h-full min-h-0" data-kanban-col="1">
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
                    className="flex flex-col flex-1 min-h-0 rounded-xl bg-slate-900/20 border border-white/5 p-2 transition-colors"
                    style={{ backgroundColor: column.cor ? hexToRgba(column.cor, 0.05) : undefined }}
                  >
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          data-kanban-cards="1"
                          className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5 rounded-lg' : ''}`}
                        >
                          {column.items.map((item, index) => (
                            <OpportunityCard
                              key={item.id_oport || (item as any).id_oportunidade}
                              opportunity={item}
                              index={index}
                              onOpen={openEdit}
                              clienteNome={
                                String((item as any).id_cliente || (item as any).cliente_id || '').trim()
                                  ? (clienteNameById[String((item as any).id_cliente || (item as any).cliente_id)] ?? null)
                                  : null
                              }
                              contatoNome={
                                String((item as any).id_contato || (item as any).contato_id || '').trim()
                                  ? (contatoNameById[String((item as any).id_contato || (item as any).contato_id)] ?? null)
                                  : null
                              }
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
            </div>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Empresa Correspondente</label>
                <select
                  value={createEmpresaCorrespondenteId}
                  onChange={(e) => setCreateEmpresaCorrespondenteId(e.target.value)}
                  disabled={createSaving || empresasCorrespondentes.length === 0}
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-bold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none disabled:opacity-50"
                >
                  {empresasCorrespondentes.length === 0 ? (
                    <option value="">Cadastre no Financeiro</option>
                  ) : (
                    empresasCorrespondentes.map((e) => (
                      <option key={String(e.empresa_id)} value={String(e.empresa_id)}>
                        {String(e.nome_fantasia || e.razao_social || 'Empresa')}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

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
                  setCreateContatoError(null)
                  setCreateContatoDraft({
                    integ_id: '',
                    contato_nome: '',
                    contato_cargo: '',
                    contato_telefone01: '',
                    contato_telefone02: '',
                    contato_email: '',
                    contato_obs: ''
                  })
                  setCreateContatoModalOpen(true)
                }}
                disabled={!createClienteId}
                className="h-[46px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Novo Contato
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
                <option value="PRODUTO">Venda de Produto</option>
                <option value="SERVICO">Venda de Serviço</option>
              </select>
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
        title={
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <UserPlus size={18} className="text-cyan-300" />
            </div>
            Novo Contato
          </div>
        }
        size="xl"
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
                const clienteId = createClienteId.trim()
                const nome = createContatoDraft.contato_nome.trim()
                const email = createContatoDraft.contato_email.trim()
                if (!clienteId) return
                if (!nome) {
                  setCreateContatoError('Nome do contato é obrigatório.')
                  return
                }
                if (email && !/^\S+@\S+\.\S+$/.test(email)) {
                  setCreateContatoError('Email do contato inválido.')
                  return
                }
                if (!myUserId) {
                  setCreateContatoError('Sessão não encontrada. Faça login novamente.')
                  return
                }
                if (createContatoSaving) return
                setCreateContatoSaving(true)
                setCreateContatoError(null)
                try {
                  const payloadBase = {
                    integ_id: createContatoDraft.integ_id.trim() || null,
                    contato_nome: nome,
                    contato_cargo: createContatoDraft.contato_cargo.trim() || null,
                    contato_telefone01: createContatoDraft.contato_telefone01.trim() || null,
                    contato_telefone02: createContatoDraft.contato_telefone02.trim() || null,
                    contato_email: email || null,
                    contato_obs: createContatoDraft.contato_obs.trim() || null
                  }
                  const created = await createClienteContato({
                    ...payloadBase,
                    cliente_id: clienteId,
                    user_id: myUserId,
                    deleted_at: null
                  } as any)
                  const refreshed = await fetchClienteContatos(clienteId)
                  setCreateContatoOptions(refreshed)
                  setCreateContatoId(created.contato_id)
                  setCreateContatoModalOpen(false)
                } catch (e) {
                  setCreateContatoError(e instanceof Error ? e.message : 'Falha ao salvar contato.')
                } finally {
                  setCreateContatoSaving(false)
                }
              }}
              disabled={createContatoSaving || !createClienteId || !createContatoDraft.contato_nome.trim()}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {createContatoSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {createContatoError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {createContatoError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Nome</label>
              <input
                value={createContatoDraft.contato_nome}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_nome: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">ID Integração</label>
              <input
                value={createContatoDraft.integ_id}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, integ_id: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: OMIE_CONTATO_123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Cargo</label>
              <input
                value={createContatoDraft.contato_cargo}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_cargo: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="Ex: Compras, Financeiro..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Email</label>
              <input
                value={createContatoDraft.contato_email}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_email: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                placeholder="email@empresa.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Telefone 01</label>
              <input
                value={createContatoDraft.contato_telefone01}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_telefone01: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Telefone 02</label>
              <input
                value={createContatoDraft.contato_telefone02}
                onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_telefone02: e.target.value }))}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações</label>
            <textarea
              value={createContatoDraft.contato_obs}
              onChange={(e) => setCreateContatoDraft((prev) => ({ ...prev, contato_obs: e.target.value }))}
              className="w-full h-28 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none"
              placeholder="Observações do contato..."
            />
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
            {activeId ? 'Informações da Proposta Comercial' : 'Nova Proposta Comercial'}
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
                <div className="space-y-5">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Identificação</div>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Código da Proposta</label>
                          <input
                            value={(draftCod || '').trim() || '-'}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-black text-slate-100 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Solução</label>
                          <input
                            value={solucaoLabel}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="xl:col-span-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Vendedor</div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-[3rem_minmax(0,1fr)] gap-4 items-start">
                        <div className="w-12 h-12 rounded-2xl border border-cyan-500/20 bg-cyan-900/20 overflow-hidden flex items-center justify-center text-[11px] font-black text-cyan-100">
                          {vendedorAvatarUrl ? (
                            <img
                              src={vendedorAvatarUrl}
                              alt={(vendedorQuery || 'Vendedor').trim() || 'Vendedor'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{getInitials((vendedorQuery || '').trim() || String(draftVendedorId || ''))}</span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Vendedor</label>
                          <input
                            value={(vendedorQuery || '').trim() || '-'}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone</label>
                          <input
                            value={vendedorTelefone || '-'}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail</label>
                          <input
                            value={vendedorEmail || '-'}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ramal</label>
                          <input
                            value={vendedorRamal || '-'}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="xl:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Status e Datas</div>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status Atual</label>
                          <select
                            value={draftStatusId}
                            onChange={(e) => setDraftStatusId(e.target.value)}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          >
                            <option value="">-</option>
                            {statuses.map((s) => (
                              <option key={s.status_id} value={s.status_id}>
                                {s.status_desc}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Inclusão</label>
                          <input
                            value={dataInclusaoLabel}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data Parado</label>
                          <input
                            value={dataParadoLabel}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-black text-slate-100 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Última Movimentação</label>
                          <input
                            value={formatDate(dataAlteracao)}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Cliente</div>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cliente</label>
                          <input
                            value={clienteQuery}
                            readOnly
                            placeholder="Cliente"
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CNPJ/CPF</label>
                            <input
                              value={draftClienteDocumento || '-'}
                              readOnly
                              placeholder="CNPJ/CPF"
                              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Origem</label>
                            <div className="relative">
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
                        </div>
                      </div>
                    </div>

                    <div className="xl:col-span-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Contato</div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Contato</label>
                          <input
                            value={draftContatoNome || '-'}
                            readOnly
                            placeholder="Nome do contato"
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cargo</label>
                          <input
                            value={draftContatoCargo || '-'}
                            placeholder="Cargo"
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail</label>
                          <input
                            value={draftContatoEmail || '-'}
                            placeholder="email@exemplo.com"
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone 01</label>
                          <input
                            value={draftContatoTelefone01 || '-'}
                            placeholder="Telefone 01"
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone 02</label>
                          <input
                            value={draftContatoTelefone02 || '-'}
                            placeholder="Telefone 02"
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Detalhes Comerciais</div>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-4 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ticket Calculado</label>
                        <input
                          value={formatCurrency(ticketCalculado)}
                          readOnly
                          className="w-full rounded-xl bg-[#0F172A] border border-emerald-500/20 px-4 py-3 text-sm font-black text-emerald-300 outline-none font-mono"
                        />
                      </div>
                      <div className="lg:col-span-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Empresa Correspondente</label>
                          <Pencil size={12} className="text-slate-500" />
                        </div>
                        <select
                          value={draftEmpresaCorrespondenteId}
                          onChange={(e) => setDraftEmpresaCorrespondenteId(e.target.value)}
                          className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                        >
                          {empresasCorrespondentes.length === 0 ? (
                            <option value="">Cadastre no Financeiro</option>
                          ) : (
                            empresasCorrespondentes.map((e) => (
                              <option key={String(e.empresa_id)} value={String(e.empresa_id)}>
                                {String(e.nome_fantasia || e.razao_social || 'Empresa')}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="lg:col-span-12 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Solicitação do Cliente</label>
                          <Pencil size={12} className="text-slate-500" />
                        </div>
                        <textarea
                          value={draftDescricao}
                          onChange={(e) => setDraftDescricao(e.target.value)}
                          placeholder="Descreva a solicitação do cliente..."
                          className="w-full h-28 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Documentos</div>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                      <div className="lg:col-span-8 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pedido de Compra</label>
                          <Pencil size={12} className="text-slate-500" />
                        </div>
                        <input
                          value={draftPedidoCompraNumero}
                          onChange={(e) => setDraftPedidoCompraNumero(e.target.value)}
                          placeholder="Número do pedido de compra..."
                          className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        />
                        <input
                          value={draftPedidoCompraPath ? (draftPedidoCompraPath.split('/').pop() || draftPedidoCompraPath) : '-'}
                          readOnly
                          className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                        />
                        <input
                          ref={pedidoCompraInputRef}
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            if (pedidoCompraUploading) return
                            setPedidoCompraUploading(true)
                            setPedidoCompraError(null)
                            try {
                              const userId = (myUserId || '').trim() || (await supabase.auth.getUser()).data.user?.id || ''
                              if (!userId) throw new Error('Sessão não encontrada. Faça login novamente.')
                              const safeName = String(file.name || 'pedido-compra').replace(/[^\w.\-]+/g, '_')
                              const path = `crm-pedidos-compra/${userId}/${(activeId || 'draft').trim()}/${Date.now()}-${safeName}`
                              const r = await supabase.storage.from('crm-pedidos-compra').upload(path, file, {
                                upsert: true,
                                contentType: file.type || undefined
                              } as any)
                              if (r.error) throw r.error
                              setDraftPedidoCompraPath(path)
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : 'Falha ao anexar.'
                              setPedidoCompraError(msg)
                              setFormError(msg)
                            } finally {
                              setPedidoCompraUploading(false)
                            }
                          }}
                        />
                      </div>
                      <div className="lg:col-span-4 flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => pedidoCompraInputRef.current?.click()}
                          disabled={pedidoCompraUploading}
                          className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 font-black text-sm disabled:opacity-50 transition-colors"
                        >
                          {pedidoCompraUploading ? 'Anexando...' : 'Anexar Pedido de Compra'}
                        </button>
                        <button
                          type="button"
                          disabled={!draftPedidoCompraPath.trim()}
                          onClick={() => {
                            const path = draftPedidoCompraPath.trim()
                            if (!path) return
                            const url = supabase.storage.from('crm-pedidos-compra').getPublicUrl(path).data.publicUrl
                            if (url) window.open(url, '_blank', 'noopener,noreferrer')
                          }}
                          className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 font-black text-sm disabled:opacity-50 transition-colors"
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-6 pt-4">
                <HorizontalScrollArea className="w-full overflow-x-auto">
                  <div className="flex gap-2 pb-2">
                    {[
                      { id: 'ticket', label: 'Pagamentos', editable: true },
                      { id: 'previsao', label: 'Previsão', editable: true },
                      { id: 'temperatura', label: 'Temperatura', editable: true },
                      { id: 'comentarios', label: 'Comentários', editable: true },
                      { id: 'observacoes', label: 'Observações', editable: true },
                      { id: 'transportadores', label: 'Transportadores', editable: true },
                      { id: 'historicos', label: 'Históricos', editable: false },
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
                        <span className="inline-flex items-center gap-2">
                          {t.editable ? <Pencil size={12} className={tab === t.id ? 'text-cyan-200' : 'text-slate-400'} /> : null}
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </HorizontalScrollArea>
              </div>

              <div className="px-4 md:px-6 py-4 pb-8">
                {tab === 'ticket' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {draftSolucao === 'PRODUTO' ? (
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
                          className="w-full px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-[0.99]"
                        >
                          Adicionar Produto
                        </button>
                      ) : draftSolucao === 'SERVICO' ? (
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
                          className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg shadow-indigo-500/15 transition-all active:scale-[0.99]"
                        >
                          Adicionar Serviço
                        </button>
                      ) : (
                        <>
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
                            className="w-full px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-[0.99]"
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
                            className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg shadow-indigo-500/15 transition-all active:scale-[0.99]"
                          >
                            Adicionar Serviço
                          </button>
                        </>
                      )}

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor Calculado</div>
                        <input
                          value={formatCurrency(ticketCalculado)}
                          readOnly
                          className="mt-2 w-full rounded-xl bg-[#0F172A] border border-emerald-500/20 px-4 py-2.5 text-sm font-black text-emerald-300 outline-none font-mono"
                        />
                        {descontoPropostaPercent > 0 ? (
                          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Bruto: {formatCurrency(ticketCalculadoBruto)} · Desconto {descontoPropostaPercent}%
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Bruto: {formatCurrency(ticketCalculadoBruto)}</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsão de Faturamento</div>
                        <input
                          type="date"
                          value={draftPrevEntrega}
                          onChange={(e) => setDraftPrevEntrega(e.target.value)}
                          className="mt-2 w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-2.5 text-sm font-black text-slate-100 outline-none font-mono focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Pagamentos</div>

                      {paymentsSchemaOk === false ? (
                        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                          Pagamentos não estão disponíveis no banco agora (API do Supabase sem a coluna condicao_pagamento_id no schema cache).
                          Aplique as migrations do CRM e recarregue o schema do Supabase/PostgREST.
                        </div>
                      ) : null}

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Forma de Pagamento</label>
                          <select
                            value={draftFormaPagamentoId}
                            onChange={(e) => setDraftFormaPagamentoId(e.target.value)}
                            disabled={paymentsSchemaOk === false}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          >
                            <option value="">-</option>
                            {formasPagamento.map((f) => (
                              <option key={f.forma_id} value={f.forma_id}>
                                {f.descricao || f.codigo}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Condição de Pagamento</label>
                          <select
                            value={draftCondicaoPagamentoId}
                            onChange={(e) => setDraftCondicaoPagamentoId(e.target.value)}
                            disabled={paymentsSchemaOk === false}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          >
                            <option value="">-</option>
                            {condicoesPagamento.map((c) => (
                              <option key={c.condicao_id} value={c.condicao_id}>
                                {c.descricao || c.codigo}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Desconto (%)</label>
                          <input
                            value={draftDescontoPropostaPercent}
                            onChange={(e) => setDraftDescontoPropostaPercent(e.target.value)}
                            disabled={paymentsSchemaOk === false}
                            inputMode="decimal"
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                            placeholder="0"
                          />
                        </div>
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

                {tab === 'previsao' && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Previsão</div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Prazo de entrega (dia/mês/ano)</label>
                          <input
                            type="date"
                            value={draftPrevEntrega}
                            onChange={(e) => setDraftPrevEntrega(e.target.value)}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'temperatura' && (
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
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Temperatura (manual)</label>
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

                {tab === 'historicos' && (
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
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observações</label>
                      <textarea
                        value={draftObs}
                        onChange={(e) => setDraftObs(e.target.value)}
                        className="w-full h-32 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
                        placeholder="Observações do cliente..."
                      />
                    </div>
                  </div>
                )}

                {tab === 'transportadores' && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Transportadores</div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Tipo de Frete</label>
                          <select
                            value={draftTipoFrete}
                            onChange={(e) => setDraftTipoFrete(e.target.value as any)}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          >
                            <option value="">-</option>
                            <option value="FOB">FOB</option>
                            <option value="CIF">CIF</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0B1220] px-4 md:px-6 py-4 md:py-6 lg:sticky lg:top-0 lg:self-start">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => handleSave()}
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
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={!activeId}
                      onClick={() => {
                        if (!activeId) return
                        const now = new Date()
                        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15)
                        const validade = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
                        setGenerateValidade(validade)
                        setGenerateTipoFrete(draftTipoFrete)
                        setGenerateValoresMode('COM')
                        setGeneratePdfError(null)
                        void preloadPropostaPdfDeps()
                        setGenerateOpen(true)
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Gerar Proposta
                    </button>

                    <button
                      type="button"
                      disabled={!activeId || !canCrmControl}
                      onClick={() => {
                        if (!activeId) return
                        setTransferError(null)
                        setTransferVendedorId(draftVendedorId)
                        setTransferOpen(true)
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 font-black text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Transferir Proposta
                    </button>

                    <button
                      type="button"
                      disabled={!activeId}
                      onClick={() => {
                        if (!activeId) return
                        setStatusChangeId(draftStatusId)
                        setStatusChangeOpen(true)
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 font-black text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Alterar o Status
                    </button>

                    <button
                      type="button"
                      disabled={!activeId}
                      onClick={async () => {
                        if (!activeId) return
                        const target = statuses.find((s) => String((s as any).status_desc || '').toLowerCase().includes('fatur'))
                        if (!target?.status_id) {
                          setFormError('Nenhum status com "Fatur" encontrado em CRM > Configs > Status.')
                          return
                        }
                        setDraftStatusId(String(target.status_id))
                        await handleSave({ statusIdOverride: String(target.status_id) })
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 font-black text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Separar para Faturar
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={!activeId}
                        onClick={() => {
                          if (!activeId) return
                          setDeleteError(null)
                          setDeleteOpen(true)
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Excluir Proposta
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Modal
          isOpen={generateOpen}
          onClose={() => setGenerateOpen(false)}
          title="Gerar Proposta"
          size="sm"
          zIndex={210}
          footer={
            <>
              <button
                type="button"
                onClick={() => setGenerateOpen(false)}
                disabled={generatePdfLoading}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!activeId || generatePdfLoading}
                onClick={async () => {
                  if (!activeId) return
                  setGeneratePdfLoading(true)
                  setGeneratePdfError(null)
                  try {
                    await downloadPropostaPdf({
                      oportunidadeId: activeId,
                      validade: generateValidade.trim() || null,
                      tipoFrete: generateTipoFrete || null,
                      showValores: generateValoresMode === 'COM'
                    })
                    setGenerateOpen(false)
                  } catch (e) {
                    setGeneratePdfError(e instanceof Error ? e.message : 'Falha ao gerar PDF.')
                  } finally {
                    setGeneratePdfLoading(false)
                  }
                }}
                className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/15 transition-all active:scale-95 inline-flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
              >
                {generatePdfLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Gerando PDF...
                  </>
                ) : (
                  'Baixar PDF'
                )}
              </button>
              <button
                type="button"
                disabled={!activeId || generatePdfLoading}
                onClick={async () => {
                  if (!activeId) return
                  setGeneratePdfLoading(true)
                  setGeneratePdfError(null)
                  try {
                    await openPropostaPdfInNewTab({
                      oportunidadeId: activeId,
                      validade: generateValidade.trim() || null,
                      tipoFrete: generateTipoFrete || null,
                      showValores: generateValoresMode === 'COM'
                    })
                    setGenerateOpen(false)
                  } catch (e) {
                    setGeneratePdfError(e instanceof Error ? e.message : 'Falha ao abrir PDF.')
                  } finally {
                    setGeneratePdfLoading(false)
                  }
                }}
                className="px-7 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                Abrir em nova aba
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {generatePdfError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{generatePdfError}</div>
            ) : null}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Validade da proposta</label>
              <input
                type="date"
                value={generateValidade}
                onChange={(e) => setGenerateValidade(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Tipo de frete / transportadora</label>
              <select
                value={generateTipoFrete}
                onChange={(e) => setGenerateTipoFrete(e.target.value as any)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                <option value="FOB">FOB</option>
                <option value="CIF">CIF</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Visualizar proposta</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateValoresMode('COM')}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-black transition-colors ${
                    generateValoresMode === 'COM'
                      ? 'bg-emerald-600 text-white border-emerald-700/30'
                      : 'bg-white/5 hover:bg-white/10 text-slate-100 border-white/10'
                  }`}
                >
                  Com Valor
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateValoresMode('SEM')}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-black transition-colors ${
                    generateValoresMode === 'SEM'
                      ? 'bg-emerald-600 text-white border-emerald-700/30'
                      : 'bg-white/5 hover:bg-white/10 text-slate-100 border-white/10'
                  }`}
                >
                  Sem Valor
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={transferOpen}
          onClose={() => {
            if (transferSaving) return
            setTransferOpen(false)
          }}
          title="Transferir Proposta"
          size="sm"
          zIndex={210}
          footer={
            <>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                disabled={transferSaving}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activeId) return
                  const nextId = transferVendedorId.trim()
                  if (!nextId) {
                    setTransferError('Selecione um vendedor.')
                    return
                  }
                  setTransferSaving(true)
                  setTransferError(null)
                  try {
                    await updateOportunidade(activeId, { id_vendedor: nextId } as any)
                    setDraftVendedorId(nextId)
                    setVendedorQuery((vendedorNameById[nextId] || '').trim())
                    await createOportunidadeComentario(activeId, `Proposta transferida para ${vendedorNameById[nextId] || nextId}.`)
                    await loadData()
                    setTransferOpen(false)
                  } catch (e) {
                    setTransferError(e instanceof Error ? e.message : 'Falha ao transferir.')
                  } finally {
                    setTransferSaving(false)
                  }
                }}
                disabled={transferSaving}
                className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
              >
                {transferSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Transferindo...
                  </>
                ) : (
                  'Transferir'
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {transferError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{transferError}</div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Vendedor</label>
              <select
                value={transferVendedorId}
                onChange={(e) => setTransferVendedorId(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {(usuarios as any[]).map((u: any) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {String(u.nome || u.email_login || u.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={statusChangeOpen}
          onClose={() => setStatusChangeOpen(false)}
          title="Alterar o Status"
          size="sm"
          zIndex={210}
          footer={
            <>
              <button
                type="button"
                onClick={() => setStatusChangeOpen(false)}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const next = statusChangeId.trim()
                  if (!next) {
                    setFormError('Selecione um status.')
                    return
                  }
                  setDraftStatusId(next)
                  setStatusChangeOpen(false)
                  await handleSave({ statusIdOverride: next })
                }}
                className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                Aplicar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Status</label>
              <select
                value={statusChangeId}
                onChange={(e) => setStatusChangeId(e.target.value)}
                className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
              >
                <option value="">-</option>
                {statuses.map((s) => (
                  <option key={s.status_id} value={s.status_id}>
                    {s.status_desc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={deleteOpen}
          onClose={() => {
            if (deleteSaving) return
            setDeleteOpen(false)
          }}
          title="Excluir Proposta"
          size="sm"
          zIndex={210}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteSaving}
                className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!activeId) return
                  setDeleteSaving(true)
                  setDeleteError(null)
                  try {
                    await deleteOportunidade(activeId)
                    setOpportunities((prev) => prev.filter((p) => (p.id_oport || (p as any).id_oportunidade) !== activeId))
                    setDeleteOpen(false)
                    setFormOpen(false)
                    setActiveId(null)
                    await loadData()
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : 'Falha ao excluir.')
                  } finally {
                    setDeleteSaving(false)
                  }
                }}
                disabled={deleteSaving}
                className="px-7 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
              >
                {deleteSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {deleteError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{deleteError}</div>
            )}
            <div className="text-sm text-slate-300">Essa ação não pode ser desfeita.</div>
          </div>
        </Modal>

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

      <Modal
        isOpen={statusObsOpen}
        onClose={() => {
          if (saving) return
          setStatusObsOpen(false)
          setStatusObsError(null)
        }}
        title="Observação do Status"
        size="md"
        zIndex={180}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setStatusObsOpen(false)
                setStatusObsError(null)
              }}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                const obs = statusObsText.trim()
                if (!obs) {
                  setStatusObsError('Informe uma observação para a troca de status.')
                  return
                }
                setStatusObsError(null)
                setStatusObsOpen(false)
                await handleSave({ skipStatusObsCheck: true, statusObs: obs })
              }}
              disabled={saving}
              className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {statusObsError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {statusObsError}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Observação</label>
            <textarea
              value={statusObsText}
              onChange={(e) => setStatusObsText(e.target.value)}
              className="w-full h-28 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none"
              placeholder="Descreva o motivo / contexto da troca de status..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
