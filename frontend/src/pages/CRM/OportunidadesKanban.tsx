import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Calendar, 
  Clock,
  List,
  ArrowUpDown,
  Loader2,
  Trash2,
  Pencil,
  UserPlus,
  Star,
  LogIn,
  Check
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
  fetchOportunidadeContatos,
  linkOportunidadeContato,
  unlinkOportunidadeContato,
  setOportunidadeContatoPrincipal,
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
import { useToast } from '@/contexts/ToastContext'
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

const toDateInputValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDaysToDateInput = (base: Date | string | null | undefined, days: number) => {
  const n = Number(days || 0)
  const safeDays = Number.isFinite(n) ? n : 0
  const dt = base ? new Date(base as any) : new Date()
  if (!Number.isFinite(dt.getTime())) return toDateInputValue(new Date())
  dt.setDate(dt.getDate() + safeDays)
  return toDateInputValue(dt)
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

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-'
  const dt = new Date(dateString)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('pt-BR', { hour12: false })
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
  statusLabel,
  vendedorNome,
  vendedorAvatarUrl
}: {
  opportunity: CRM_Oportunidade
  index: number
  onOpen: (id: string) => void
  clienteNome: string | null
  statusLabel: string | null
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
  const vendedorLabel = ((opportunity as any).vendedor_nome || opportunity.vendedor || vendedorNome || '').trim() || null
  const statusText = String(statusLabel || (opportunity as any).status_desc || (opportunity as any).status || '').trim()
  const hasTemperatura =
    (opportunity as any).temperatura !== null &&
    (opportunity as any).temperatura !== undefined &&
    String((opportunity as any).temperatura).trim() !== ''
  const temperatura = hasTemperatura ? Number((opportunity as any).temperatura) || 0 : 0
  const tempBucket = !hasTemperatura ? null : temperatura <= 30 ? 'FRIA' : temperatura <= 60 ? 'MORNA' : temperatura <= 85 ? 'QUENTE' : 'MUITO QUENTE'
  const tempBadge =
    tempBucket === 'FRIA'
      ? 'text-sky-200 bg-sky-500/10 border-sky-500/20'
      : tempBucket === 'MORNA'
        ? 'text-amber-200 bg-amber-500/10 border-amber-500/20'
        : tempBucket === 'QUENTE'
          ? 'text-orange-200 bg-orange-500/10 border-orange-500/20'
          : 'text-rose-200 bg-rose-500/10 border-rose-500/20'
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
                  <span className={`text-[11px] font-black px-3 py-1 rounded-xl border ${tempBadge}`}>{`🌡${Math.min(100, Math.max(0, Math.round(temperatura)))}º`}</span>
                </div>
              )}
            </div>

            <div className="flex-1 flex justify-center px-2">
              {statusText ? (
                <span
                  className="max-w-[180px] truncate text-[10px] font-black uppercase tracking-wider text-slate-200 bg-white/5 px-3 py-1 rounded-xl border border-white/10"
                  title={statusText}
                >
                  {statusText}
                </span>
              ) : null}
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
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatusId, setFilterStatusId] = useState<string>('')
  const [filterFaseId, setFilterFaseId] = useState<string>('')
  const [itensSearchByOport, setItensSearchByOport] = useState<Record<string, string>>({})
  const [itensDisplayByOport, setItensDisplayByOport] = useState<Record<string, string>>({})
  const [itensSearchLoading, setItensSearchLoading] = useState(false)
  const [listSort, setListSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'valor', direction: 'desc' })
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createClienteQuery, setCreateClienteQuery] = useState('')
  const [createClienteId, setCreateClienteId] = useState('')
  const [createClienteOpen, setCreateClienteOpen] = useState(false)
  const [createClienteLoading, setCreateClienteLoading] = useState(false)
  const [createClienteOptions, setCreateClienteOptions] = useState<Cliente[]>([])
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
  const [contatoModalClienteId, setContatoModalClienteId] = useState('')
  const [contatoModalOportunidadeId, setContatoModalOportunidadeId] = useState<string | null>(null)
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
  const [oportunidadeContatos, setOportunidadeContatos] = useState<
    Array<{ contatoId: string; isPrincipal: boolean; contato: ClienteContato | null }>
  >([])
  const [oportunidadeContatosLoading, setOportunidadeContatosLoading] = useState(false)
  const [oportunidadeContatosError, setOportunidadeContatosError] = useState<string | null>(null)
  const [oportunidadeContatosSelectedId, setOportunidadeContatosSelectedId] = useState('')
  const [oportunidadeContatosReloadKey, setOportunidadeContatosReloadKey] = useState(0)
  const [contatoAddId, setContatoAddId] = useState('')
  const [contatoAddQuery, setContatoAddQuery] = useState('')
  const [contatoAddOpen, setContatoAddOpen] = useState(false)
  const [contatoAddBarOpen, setContatoAddBarOpen] = useState(false)
  const [contatoOpsSaving, setContatoOpsSaving] = useState(false)
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
  const [draftPrevFechamento, setDraftPrevFechamento] = useState('')
  const [draftFormaPagamentoId, setDraftFormaPagamentoId] = useState('')
  const [draftCondicaoPagamentoId, setDraftCondicaoPagamentoId] = useState('')
  const [draftDescontoPropostaPercent, setDraftDescontoPropostaPercent] = useState('0')
  const [draftTipoFrete, setDraftTipoFrete] = useState<'FOB' | 'CIF' | ''>('')
  const [draftValidadeProposta, setDraftValidadeProposta] = useState('')
  const [draftProdutoId, setDraftProdutoId] = useState('')
  const [draftServicoId, setDraftServicoId] = useState('')
  const [draftObs, setDraftObs] = useState('')
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftPedidoCompraNumero, setDraftPedidoCompraNumero] = useState('')
  const [draftPedidoCompraPath, setDraftPedidoCompraPath] = useState('')
  const [pedidoCompraUploading, setPedidoCompraUploading] = useState(false)
  const [pedidoCompraError, setPedidoCompraError] = useState<string | null>(null)
  const [draftItens, setDraftItens] = useState<DraftItem[]>([])
  const [draftItensLoaded, setDraftItensLoaded] = useState(false)
  const [draftItensTouched, setDraftItensTouched] = useState(false)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [tab, setTab] = useState<
    'pagamento' | 'temperatura' | 'comentarios' | 'observacoes' | 'historicos'
  >('pagamento')
  const pedidoCompraInputRef = useRef<HTMLInputElement | null>(null)
  const draftItensTouchedRef = useRef(false)
  const formInitRef = useRef<string | null>(null)

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
  const [statusChangeObs, setStatusChangeObs] = useState('')
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null)
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false)
  const [statusHistoryError, setStatusHistoryError] = useState<string | null>(null)
  const [statusHistoryUserById, setStatusHistoryUserById] = useState<Record<string, string>>({})

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateOportunidadeId, setGenerateOportunidadeId] = useState<string | null>(null)
  const [generatePdfLoading, setGeneratePdfLoading] = useState(false)
  const [generatePdfError, setGeneratePdfError] = useState<string | null>(null)
  const [generatePreparing, setGeneratePreparing] = useState(false)
  const [generateShowValores, setGenerateShowValores] = useState(true)

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
  const { pushToast } = useToast()

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
        const probe = await (supabase as any)
          .from('crm_oportunidades')
          .select('forma_pagamento_id, condicao_pagamento_id, tipo_frete, validade_proposta')
          .limit(1)
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
    if (!formOpen) {
      formInitRef.current = null
      return
    }
    setFormError(null)

    const key = activeId ? `edit:${String(activeId).trim()}` : 'new'
    if (formInitRef.current === key) return

    if (activeId && !active) return
    formInitRef.current = key

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
      setDraftPrevFechamento((active as any).prev_fechamento ? String((active as any).prev_fechamento).slice(0, 10) : '')
      setDraftFormaPagamentoId(String((active as any).forma_pagamento_id || ''))
      setDraftCondicaoPagamentoId(String((active as any).condicao_pagamento_id || ''))
      {
        const v = (active as any).desconto_percent_proposta
        setDraftDescontoPropostaPercent(v === null || v === undefined ? '0' : String(v))
      }
      setDraftTipoFrete(((active as any).tipo_frete as any) || '')
      {
        const raw = (active as any).validade_proposta
        const base = active.data_inclusao ?? (active as any).criado_em ?? null
        setDraftValidadeProposta(raw ? String(raw).slice(0, 10) : addDaysToDateInput(base, 15))
      }
      setDraftProdutoId(active.cod_produto || '')
      setDraftServicoId(active.cod_servico || '')
      setDraftObs(active.obs_oport || '')
      setDraftDescricao(active.descricao_oport || '')
      setDraftPedidoCompraNumero(String((active as any).pedido_compra_numero || '').trim())
      setDraftPedidoCompraPath(String((active as any).pedido_compra_path || '').trim())
      setPedidoCompraError(null)
      setPedidoCompraUploading(false)

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
      setDraftPrevFechamento('')
      setDraftFormaPagamentoId('')
      setDraftCondicaoPagamentoId('')
      setDraftDescontoPropostaPercent('0')
      setDraftTipoFrete('')
      setDraftValidadeProposta(addDaysToDateInput(new Date(), 15))
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
    setTab('pagamento')
  }, [formOpen, activeId, active, canCrmControl, myUserId, myUserName])

  useEffect(() => {
    if (!formOpen) return
    if (!draftItensLoaded) return
    if (draftSolucao === 'PRODUTO') {
      setDraftItens((prev) => prev.filter((i) => i.tipo === 'PRODUTO'))
    } else if (draftSolucao === 'SERVICO') {
      setDraftItens((prev) => prev.filter((i) => i.tipo === 'SERVICO'))
    }
  }, [formOpen, draftSolucao, draftItensLoaded])

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
    if (!active) return

    setDraftItensLoaded(false)
    draftItensTouchedRef.current = false
    setDraftItensTouched(false)
    setDraftItens([])
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
        setDraftItens((prev) => (draftItensTouchedRef.current ? prev : mapped))
        setDraftItensLoaded(true)
      })
      .catch(() => {
        setDraftItens((prev) => (draftItensTouchedRef.current ? prev : []))
        setDraftItensLoaded(true)
      })
  }, [formOpen, activeId, active])

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
    const oportId = String(activeId || '').trim()
    const clienteId = draftClienteId.trim()
    if (!oportId || !clienteId) {
      setOportunidadeContatos([])
      setOportunidadeContatosSelectedId('')
      setOportunidadeContatosError(null)
      setContatoAddId('')
      return
    }
    let cancelled = false
    setOportunidadeContatosLoading(true)
    setOportunidadeContatosError(null)
    ;(async () => {
      const linksInitial = await fetchOportunidadeContatos(oportId)
      let links = linksInitial

      if (links.length === 0) {
        const legacyContatoId = String((active as any)?.id_contato || (active as any)?.contato_id || '').trim()
        if (legacyContatoId) {
          try {
            await linkOportunidadeContato({ oportunidadeId: oportId, contatoId: legacyContatoId, isPrincipal: true })
            links = await fetchOportunidadeContatos(oportId)
          } catch {}
        }
      }

      const clienteContatos = await fetchClienteContatos(clienteId)
      const mapById = new Map(clienteContatos.map((c) => [String(c.contato_id).trim(), c]))

      const items = await Promise.all(
        links.map(async (l) => {
          const id = String(l.contato_id || '').trim()
          let contato = mapById.get(id) || null
          if (!contato) {
            try {
              contato = (await fetchContatoById(id)) || null
            } catch {
              contato = null
            }
          }
          return { contatoId: id, isPrincipal: !!l.is_principal, contato }
        })
      )

      if (cancelled) return
      setOportunidadeContatos(items)
      const principalId = items.find((x) => x.isPrincipal)?.contatoId || items[0]?.contatoId || ''
      setOportunidadeContatosSelectedId(principalId)
      setContatoAddId('')
    })()
      .catch((e) => {
        if (cancelled) return
        setOportunidadeContatos([])
        setOportunidadeContatosSelectedId('')
        setContatoAddId('')
        setOportunidadeContatosError(e instanceof Error ? e.message : 'Falha ao carregar contatos.')
      })
      .finally(() => {
        if (cancelled) return
        setOportunidadeContatosLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [formOpen, activeId, active, draftClienteId, oportunidadeContatosReloadKey])

  useEffect(() => {
    if (!formOpen) return
    const id = draftClienteId.trim()
    if (!id) {
      setDraftClienteDocumento('')
      return
    }
    if (activeId && draftClienteDocumento.trim()) return
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
  }, [formOpen, activeId, draftClienteId, draftClienteDocumento])

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
    if (snapshotContatoFromId === id) return
    const shouldHydrateContatoFields =
      !activeId ||
      (!draftContatoNome.trim() &&
        !draftContatoCargo.trim() &&
        !draftContatoTelefone01.trim() &&
        !draftContatoTelefone02.trim() &&
        !draftContatoEmail.trim())
    const c = contatoOptions.find((x) => x.contato_id === id) || null
    if (c) {
      setDraftContatoDetails(c)
      if (shouldHydrateContatoFields) {
        setDraftContatoNome(String(c.contato_nome || ''))
        setDraftContatoCargo(String(c.contato_cargo || ''))
        setDraftContatoTelefone01(String(c.contato_telefone01 || ''))
        setDraftContatoTelefone02(String(c.contato_telefone02 || ''))
        setDraftContatoEmail(String(c.contato_email || ''))
      }
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
      if (shouldHydrateContatoFields) {
        setDraftContatoNome(String(fetched.contato_nome || ''))
        setDraftContatoCargo(String(fetched.contato_cargo || ''))
        setDraftContatoTelefone01(String(fetched.contato_telefone01 || ''))
        setDraftContatoTelefone02(String(fetched.contato_telefone02 || ''))
        setDraftContatoEmail(String(fetched.contato_email || ''))
      }
      if (!contatoQuery.trim() && fetched.contato_nome) setContatoQuery(fetched.contato_nome)
      setSnapshotContatoFromId(id)
    })().catch(() => {
      if (cancelled) return
      setDraftContatoDetails(null)
    })
    return () => {
      cancelled = true
    }
  }, [
    formOpen,
    activeId,
    draftContatoId,
    contatoOptions,
    snapshotContatoFromId,
    draftContatoNome,
    draftContatoCargo,
    draftContatoTelefone01,
    draftContatoTelefone02,
    draftContatoEmail,
    contatoQuery
  ])

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
  const diasAbertos = calcDaysSince(dataInclusao)
  const ultimaMovimentacao = useMemo(() => {
    const act = (atividades || [])[0]
    const ts = String((act as any)?.created_at || '').trim()
    if (ts) return ts
    return dataAlteracao
  }, [atividades, dataAlteracao])
  const diasSemMovimentacao = calcDaysSince(ultimaMovimentacao)
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
  const dataInclusaoLabel = formatDateTime(dataInclusao)
  const ultimaMovimentacaoLabel = formatDateTime(ultimaMovimentacao)

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
      valor: Number(itemModalTipo === 'PRODUTO' ? x.produto_valor : x.valor_serv) || 0
    }))
    if (!term) return mapped.slice(0, 12)
    return mapped
      .filter((x) => String(x.label || '').toLowerCase().includes(term))
      .slice(0, 12)
  }, [itemSearch, itemModalTipo, produtos, servicos])

  const itemSelected = useMemo(() => {
    const id = String(itemSelectedId || '').trim()
    if (!id) return null
    if (itemModalTipo === 'PRODUTO') {
      const p = produtos.find((x) => String((x as any).prod_id || '').trim() === id)
      if (!p) return null
      return { tipo: 'PRODUTO' as const, id: p.prod_id, descricao: p.descricao_prod, valorUnitario: Number(p.produto_valor || 0) }
    }
    const s = servicos.find((x) => String((x as any).serv_id || '').trim() === id)
    if (!s) return null
    return { tipo: 'SERVICO' as const, id: s.serv_id, descricao: s.descricao_serv, valorUnitario: Number((s as any).valor_serv ?? 0) }
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
    setCreateOrigemId('')
    setCreateVendedorId(canCrmControl ? '' : myUserId)
    setCreateEmpresaCorrespondenteId('')
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
    const origemId = createOrigemId.trim()
    const vendedorId = (canCrmControl ? createVendedorId : myUserId).trim()
    const ticketValor = parseMoney(createTicket)
    const prevEntrega = createPrevFechamento.trim() ? `${createPrevFechamento.trim()}-01` : null
    const solicitacao = createSolicitacao.trim()
    const empresaId = (createEmpresaCorrespondenteId || '').trim()
    const empresaNome = empresaId ? (empresaNomeById.get(empresaId) || '').trim() || 'Apliflow' : 'Apliflow'

    if (!clienteId) {
      setCreateError('Selecione um cliente.')
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
    if (empresasCorrespondentes.length === 0) {
      setCreateError('Cadastre a empresa correspondente no Financeiro.')
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
      const clienteNomeSnapshot = (cliente?.cliente_nome_razao_social || createClienteQuery.trim() || null) as string | null
      const clienteDocSnapshot = (cliente?.cliente_documento_formatado || cliente?.cliente_documento || null) as string | null

      const created = await createOportunidade({
        id_cliente: clienteId,
        id_contato: null,
        id_origem: origemId,
        id_vendedor: vendedorId,
        cliente_nome: clienteNomeSnapshot,
        cliente_documento: clienteDocSnapshot,
        contato_nome: null,
        contato_cargo: null,
        contato_telefone01: null,
        contato_telefone02: null,
        contato_email: null,
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
          contato_nome: null,
          contato_cargo: null,
          contato_telefone01: null,
          contato_telefone02: null,
          contato_email: null,
          cliente: clienteNomeSnapshot || (createClienteQuery || '').trim() || (created as any)?.cliente || null,
          nome_contato: null,
          telefone01_contato: null,
          telefone02_contato: null,
          email: null,
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
        setDraftContatoId('')
        setDraftContatoNome('')
        setDraftContatoCargo('')
        setDraftContatoTelefone01('')
        setDraftContatoTelefone02('')
        setDraftContatoEmail('')
        setOportunidadeContatos([])
        setOportunidadeContatosSelectedId('')
        setContatoAddId('')
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

  const createSubmitDisabled =
    createSaving ||
    !createClienteId.trim() ||
    !createOrigemId.trim() ||
    !(canCrmControl ? createVendedorId.trim() : myUserId.trim()) ||
    !createEmpresaCorrespondenteId.trim() ||
    !createSolicitacao.trim()

  const solucaoUi = useMemo(() => {
    if (draftSolucao === 'SERVICO') {
      return {
        label: 'Venda de Serviço',
        iconBg: 'bg-blue-500/10',
        iconBorder: 'border-blue-500/20',
        iconText: 'text-blue-300',
        badge: 'bg-blue-500/10 border-blue-500/20 text-blue-200'
      }
    }
    if (draftSolucao === 'PRODUTO') {
      return {
        label: 'Venda de Produto',
        iconBg: 'bg-orange-500/10',
        iconBorder: 'border-orange-500/20',
        iconText: 'text-orange-300',
        badge: 'bg-orange-500/10 border-orange-500/20 text-orange-200'
      }
    }
    return {
      label: 'Produto + Serviço',
      iconBg: 'bg-violet-500/10',
      iconBorder: 'border-violet-500/20',
      iconText: 'text-violet-300',
      badge: 'bg-violet-500/10 border-violet-500/20 text-violet-200'
    }
  }, [draftSolucao])

  const markDraftItensTouched = useCallback(() => {
    if (draftItensTouchedRef.current) return
    draftItensTouchedRef.current = true
    setDraftItensTouched(true)
  }, [])

  const getCondicaoPrazoDias = useCallback(
    (condicaoIdRaw: string) => {
      const condicaoId = String(condicaoIdRaw || '').trim()
      if (!condicaoId) return null
      const c = condicoesPagamento.find((x) => String(x.condicao_id || '').trim() === condicaoId)
      if (!c) return null
      const arr = Array.isArray(c.parcelas_dias) ? c.parcelas_dias : null
      if (arr && arr.length) {
        const max = Math.max(...arr.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0)))
        return Number.isFinite(max) ? Math.max(0, max) : null
      }
      const txt = `${String(c.descricao || '')} ${String(c.codigo || '')}`.toLowerCase()
      if (txt.includes('à vista') || txt.includes('avista') || txt.includes('a vista')) return 0
      const m = txt.match(/(\d{1,3})/)
      if (m?.[1]) {
        const v = Number.parseInt(m[1], 10)
        return Number.isFinite(v) ? Math.max(0, v) : null
      }
      return null
    },
    [condicoesPagamento]
  )

  const currentDraftSnapshot = useMemo(() => {
    return JSON.stringify({
      activeId: String(activeId || '').trim(),
      draftCod,
      draftVendedorId,
      draftEmpresaCorrespondenteId,
      draftClienteId,
      draftClienteDocumento,
      draftContatoId,
      draftContatoNome,
      draftContatoCargo,
      draftContatoTelefone01,
      draftContatoTelefone02,
      draftContatoEmail,
      draftFaseId,
      draftStatusId,
      baselineStatusId,
      draftMotivoId,
      draftOrigemId,
      draftSolucao,
      draftTicket,
      draftTemperatura,
      draftQtd,
      draftPrevEntrega,
      draftPrevFechamento,
      draftFormaPagamentoId,
      draftCondicaoPagamentoId,
      draftDescontoPropostaPercent,
      draftTipoFrete,
      draftValidadeProposta,
      draftProdutoId,
      draftServicoId,
      draftObs,
      draftDescricao,
      draftPedidoCompraNumero,
      draftPedidoCompraPath,
      comentariosDraft: (comentariosDraft || []).map((c) => ({ comentario: c.comentario, createdAt: c.createdAt })),
      draftItens: (draftItens || []).map((it) => ({
        tipo: it.tipo,
        produtoId: it.produtoId,
        servicoId: it.servicoId,
        descricao: it.descricao,
        quantidade: it.quantidade,
        descontoPercent: it.descontoPercent,
        valorUnitario: it.valorUnitario
      }))
    })
  }, [
    activeId,
    draftCod,
    draftVendedorId,
    draftEmpresaCorrespondenteId,
    draftClienteId,
    draftClienteDocumento,
    draftContatoId,
    draftContatoNome,
    draftContatoCargo,
    draftContatoTelefone01,
    draftContatoTelefone02,
    draftContatoEmail,
    draftFaseId,
    draftStatusId,
    baselineStatusId,
    draftMotivoId,
    draftOrigemId,
    draftSolucao,
    draftTicket,
    draftTemperatura,
    draftQtd,
    draftPrevEntrega,
    draftPrevFechamento,
    draftFormaPagamentoId,
    draftCondicaoPagamentoId,
    draftDescontoPropostaPercent,
    draftTipoFrete,
    draftValidadeProposta,
    draftProdutoId,
    draftServicoId,
    draftObs,
    draftDescricao,
    draftPedidoCompraNumero,
    draftPedidoCompraPath,
    comentariosDraft,
    draftItens
  ])

  const isDirty = useMemo(() => {
    if (!lastSavedSnapshot) return false
    return currentDraftSnapshot !== lastSavedSnapshot
  }, [currentDraftSnapshot, lastSavedSnapshot])

  const saveUiState = useMemo(() => {
    if (saving) return 'saving' as const
    return isDirty ? ('dirty' as const) : ('saved' as const)
  }, [saving, isDirty])

  const canGenerateProposta = useMemo(() => {
    if (paymentsSchemaOk === false) return false
    if (!draftFormaPagamentoId.trim()) return false
    if (!draftCondicaoPagamentoId.trim()) return false
    if (!draftPrevEntrega.trim()) return false
    if (!draftValidadeProposta.trim()) return false
    if (!draftTipoFrete.trim()) return false
    if (draftItens.length === 0) return false
    if (saving) return false
    return true
  }, [
    paymentsSchemaOk,
    draftFormaPagamentoId,
    draftCondicaoPagamentoId,
    draftPrevEntrega,
    draftValidadeProposta,
    draftTipoFrete,
    draftItens.length,
    saving
  ])

  useEffect(() => {
    if (!formOpen) {
      setLastSavedSnapshot('')
      setDraftItensLoaded(false)
      return
    }
    setLastSavedSnapshot('')
    setDraftItensLoaded(!activeId)
  }, [formOpen, activeId])

  useEffect(() => {
    if (!formOpen) return
    if (saving) return
    if (lastSavedSnapshot) return
    if (!formInitRef.current) return
    if (activeId && formInitRef.current !== `edit:${String(activeId).trim()}`) return
    if (!activeId && formInitRef.current !== 'new') return
    if (activeId && !draftItensLoaded) return
    setLastSavedSnapshot(currentDraftSnapshot)
  }, [formOpen, saving, lastSavedSnapshot, activeId, draftItensLoaded, currentDraftSnapshot])

  const contatoPrincipal = useMemo(() => {
    return oportunidadeContatos.find((x) => x.isPrincipal) || null
  }, [oportunidadeContatos])

  const contatoSelecionado = useMemo(() => {
    const id = oportunidadeContatosSelectedId.trim()
    if (!id) return contatoPrincipal?.contato || null
    return oportunidadeContatos.find((x) => x.contatoId === id)?.contato || null
  }, [oportunidadeContatos, oportunidadeContatosSelectedId, contatoPrincipal])

  const contatoAddCandidate = useMemo(() => {
    const id = contatoAddId.trim()
    if (!id) return null
    return contatoOptions.find((c) => c.contato_id === id) || null
  }, [contatoAddId, contatoOptions])

  const contatoAddOptions = useMemo(() => {
    const linked = new Set(oportunidadeContatos.map((x) => x.contatoId))
    return contatoOptions.filter((c) => !linked.has(String(c.contato_id).trim()))
  }, [contatoOptions, oportunidadeContatos])

  const contatoAddFiltered = useMemo(() => {
    const term = contatoAddQuery.trim().toLowerCase()
    const base = contatoAddOptions
    if (!term) return base.slice(0, 12)
    return base
      .filter((c) => {
        const txt = `${c.contato_nome || ''} ${c.contato_email || ''} ${c.contato_telefone01 || ''} ${c.contato_telefone02 || ''} ${c.contato_cargo || ''}`.toLowerCase()
        return txt.includes(term)
      })
      .slice(0, 12)
  }, [contatoAddOptions, contatoAddQuery])

  const contatoModalClienteNome = useMemo(() => {
    const id = contatoModalClienteId.trim()
    if (!id) return ''
    const cached = String(clienteNameById[id] || '').trim()
    if (cached) return cached
    if (draftClienteId.trim() === id) return String(clienteQuery || '').trim()
    return ''
  }, [contatoModalClienteId, clienteNameById, draftClienteId, clienteQuery])

  const contatoModalClienteDocumento = useMemo(() => {
    const id = contatoModalClienteId.trim()
    if (!id) return ''
    if (draftClienteId.trim() === id) return String(draftClienteDocumento || '').trim()
    return ''
  }, [contatoModalClienteId, draftClienteId, draftClienteDocumento])

  const addContatoToProposta = async () => {
    const oportId = String(activeId || '').trim()
    const clienteId = draftClienteId.trim()
    const contatoId = contatoAddId.trim()
    if (!oportId) return
    if (!clienteId) return
    if (!contatoId) {
      setOportunidadeContatosError('Selecione um contato para adicionar.')
      return
    }
    if (contatoOpsSaving) return
    setContatoOpsSaving(true)
    setOportunidadeContatosError(null)
    try {
      await linkOportunidadeContato({ oportunidadeId: oportId, contatoId })

      const shouldSetPrincipal = !contatoPrincipal && oportunidadeContatos.length === 0
      if (shouldSetPrincipal) {
        await setOportunidadeContatoPrincipal({ oportunidadeId: oportId, contatoId })
        const contato = contatoAddCandidate || (await fetchContatoById(contatoId))
        await updateOportunidade(oportId, {
          id_contato: contatoId,
          contato_nome: contato?.contato_nome || null,
          contato_cargo: contato?.contato_cargo || null,
          contato_telefone01: contato?.contato_telefone01 || null,
          contato_telefone02: contato?.contato_telefone02 || null,
          contato_email: contato?.contato_email || null
        } as any)
        setDraftContatoId(contatoId)
      }

      if (contatoAddCandidate?.contato_nome) {
        setContatoNameById((prev) => ({ ...prev, [String(contatoAddCandidate.contato_id)]: String(contatoAddCandidate.contato_nome) }))
      }
      setOportunidadeContatosSelectedId(contatoId)
      setContatoAddId('')
      setContatoAddQuery('')
      setContatoAddOpen(false)
      setContatoAddBarOpen(false)
      setOportunidadeContatosReloadKey((prev) => prev + 1)
      await loadData()
    } catch (e) {
      setOportunidadeContatosError(e instanceof Error ? e.message : 'Falha ao adicionar contato.')
    } finally {
      setContatoOpsSaving(false)
    }
  }

  const setContatoPrincipalOnProposta = async (contatoIdRaw: string) => {
    const oportId = String(activeId || '').trim()
    const contatoId = String(contatoIdRaw || '').trim()
    if (!oportId) return
    if (!contatoId) return
    if (contatoOpsSaving) return
    setContatoOpsSaving(true)
    setOportunidadeContatosError(null)
    try {
      await setOportunidadeContatoPrincipal({ oportunidadeId: oportId, contatoId })
      const contato =
        oportunidadeContatos.find((x) => x.contatoId === contatoId)?.contato ||
        contatoOptions.find((c) => c.contato_id === contatoId) ||
        (await fetchContatoById(contatoId))
      await updateOportunidade(oportId, {
        id_contato: contatoId,
        contato_nome: contato?.contato_nome || null,
        contato_cargo: contato?.contato_cargo || null,
        contato_telefone01: contato?.contato_telefone01 || null,
        contato_telefone02: contato?.contato_telefone02 || null,
        contato_email: contato?.contato_email || null
      } as any)
      setDraftContatoId(contatoId)
      setOportunidadeContatosSelectedId(contatoId)
      setOportunidadeContatosReloadKey((prev) => prev + 1)
      await loadData()
    } catch (e) {
      setOportunidadeContatosError(e instanceof Error ? e.message : 'Falha ao definir contato principal.')
    } finally {
      setContatoOpsSaving(false)
    }
  }

  const removeContatoFromProposta = async (contatoIdRaw: string) => {
    const oportId = String(activeId || '').trim()
    const contatoId = String(contatoIdRaw || '').trim()
    if (!oportId) return
    if (!contatoId) return
    if (contatoOpsSaving) return
    setContatoOpsSaving(true)
    setOportunidadeContatosError(null)
    try {
      const wasPrincipal = !!oportunidadeContatos.find((x) => x.contatoId === contatoId)?.isPrincipal
      await unlinkOportunidadeContato({ oportunidadeId: oportId, contatoId })

      if (wasPrincipal) {
        const remaining = await fetchOportunidadeContatos(oportId)
        if (remaining.length === 0) {
          await updateOportunidade(oportId, {
            id_contato: null,
            contato_nome: null,
            contato_cargo: null,
            contato_telefone01: null,
            contato_telefone02: null,
            contato_email: null
          } as any)
          setDraftContatoId('')
          setOportunidadeContatosSelectedId('')
        } else {
          const nextId = String(remaining[0]?.contato_id || '').trim()
          if (nextId) {
            await setOportunidadeContatoPrincipal({ oportunidadeId: oportId, contatoId: nextId })
            const contato =
              contatoOptions.find((c) => c.contato_id === nextId) ||
              (await fetchContatoById(nextId))
            await updateOportunidade(oportId, {
              id_contato: nextId,
              contato_nome: contato?.contato_nome || null,
              contato_cargo: contato?.contato_cargo || null,
              contato_telefone01: contato?.contato_telefone01 || null,
              contato_telefone02: contato?.contato_telefone02 || null,
              contato_email: contato?.contato_email || null
            } as any)
            setDraftContatoId(nextId)
            setOportunidadeContatosSelectedId(nextId)
          }
        }
      }

      setOportunidadeContatosReloadKey((prev) => prev + 1)
      await loadData()
    } catch (e) {
      setOportunidadeContatosError(e instanceof Error ? e.message : 'Falha ao remover contato.')
    } finally {
      setContatoOpsSaving(false)
    }
  }

  const handleSave = async (opts?: { skipStatusObsCheck?: boolean; statusObs?: string | null; statusIdOverride?: string | null }) => {
    const clienteId = draftClienteId.trim()
    const vendedorId = (canCrmControl ? draftVendedorId : (myUserId || draftVendedorId)).trim()
    const lockedClienteId = activeId ? ((active?.id_cliente || clienteId).trim()) : clienteId
    const lockedVendedorId = activeId ? ((active?.id_vendedor || vendedorId).trim()) : vendedorId
    if (!lockedClienteId) {
      setFormError('Selecione um cliente.')
      return null
    }
    if (!lockedVendedorId) {
      setFormError('Selecione um vendedor.')
      return null
    }

    const temp = Number.parseInt(draftTemperatura, 10)
    const temperatura = Number.isFinite(temp) ? Math.min(100, Math.max(0, temp)) : null
    const qts_item = draftItens.length
      ? draftItens.reduce((acc, it) => acc + (Number(it.quantidade || 0) || 0), 0)
      : null
    const prev_entrega = draftPrevEntrega.trim() || null
    const prev_fechamento = draftPrevFechamento.trim() || null
    const finalFaseId = activeId ? draftFaseId : (leadStageId || draftFaseId)
    const finalStatusId = (opts?.statusIdOverride || '').trim() || draftStatusId || andamentoStatusId || ''
    const faseLabel = stages.find(s => s.id === finalFaseId)?.label || null
    const solucao = draftSolucao
    const empresaId = (draftEmpresaCorrespondenteId || '').trim() || defaultEmpresaCorrespondenteId
    const empresaNome = (empresaNomeById.get(empresaId) || '').trim() || 'Apliflow'

    if (
      paymentsSchemaOk === false &&
      (
        draftFormaPagamentoId.trim() ||
        draftCondicaoPagamentoId.trim() ||
        descontoPropostaPercent > 0 ||
        draftTipoFrete.trim() ||
        draftValidadeProposta.trim()
      )
    ) {
      setFormError(
        'Pagamentos não estão disponíveis no banco agora (API do Supabase sem a coluna condicao_pagamento_id no schema cache). Aplique as migrations do CRM e recarregue o schema do Supabase/PostgREST.'
      )
      return null
    }
    if (!empresaId) {
      setFormError('Selecione a empresa correspondente.')
      return null
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
      prev_fechamento,
      validade_proposta: draftValidadeProposta.trim() || null,
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
      return null
    }

    setSaving(true)
    setFormError(null)
    try {
      let savedSnapshot = currentDraftSnapshot
      let savedId: string | null = String(activeId || '').trim() || null
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
        if (statusChanged) {
          const fromDesc = statuses.find((s) => s.status_id === baseline)?.status_desc || '—'
          const toDesc = statuses.find((s) => s.status_id === next)?.status_desc || '—'
          const msg = statusObs
            ? `Status alterado: ${fromDesc} → ${toDesc}\nComentário: ${statusObs}`
            : `Status alterado: ${fromDesc} → ${toDesc}`
          await createOportunidadeComentario(activeId, msg)
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
          setActiveId(String(newId))
          savedId = String(newId)
          try {
            const obj = JSON.parse(savedSnapshot)
            obj.activeId = String(newId)
            savedSnapshot = JSON.stringify(obj)
          } catch {}
        }
      }
      if (statusChanged) {
        setBaselineStatusId(next)
        try {
          const obj = JSON.parse(savedSnapshot)
          obj.baselineStatusId = next
          savedSnapshot = JSON.stringify(obj)
        } catch {}
      }
      await loadData()
      if (savedId) {
        try {
          const acts = await fetchOportunidadeAtividades(savedId)
          setAtividades(acts)
        } catch {
          setAtividades([])
        }
      }
      setLastSavedSnapshot(savedSnapshot)
      draftItensTouchedRef.current = false
      setDraftItensTouched(false)
      pushToast({ kind: 'system', title: 'SALVO ✓', message: 'Salvo com sucesso.', durationMs: 2200 })
      return savedId
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleGerarProposta = async () => {
    if (generatePdfLoading) return
    if (!canGenerateProposta) return

    setGeneratePdfError(null)
    setGeneratePreparing(true)
    setGenerateShowValores(true)
    setGenerateOportunidadeId(activeId ? String(activeId) : null)
    setGenerateOpen(true)
    void preloadPropostaPdfDeps()

    try {
      const savedId = isDirty || !activeId ? await handleSave({ skipStatusObsCheck: true }) : (activeId as any)
      const oportunidadeId = String(savedId || activeId || '').trim()
      if (!oportunidadeId) return
      setGenerateOportunidadeId(oportunidadeId)

      const propostaStage =
        stages.find((s) => String(s.label || '').trim().toLowerCase() === 'proposta') ||
        stages.find((s) => String(s.label || '').trim().toLowerCase().includes('proposta')) ||
        null

      const currentStageId = String(active?.id_fase || draftFaseId || '').trim()
      if (propostaStage?.id && propostaStage.id !== currentStageId) {
        try {
          await updateOportunidade(oportunidadeId, { id_fase: propostaStage.id, fase: propostaStage.label } as any)
          setDraftFaseId(propostaStage.id)
        } catch (e) {
          setFormError(e instanceof Error ? e.message : 'Falha ao mover para a coluna Proposta.')
        }
      }

      await loadData()
    } finally {
      setGeneratePreparing(false)
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

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase()
    const wantsProduto = !!term && (/[0-9]/.test(term) || term.startsWith('#') || term.startsWith('p:') || term.startsWith('s:'))
    if (!wantsProduto) return
    if (opportunities.length === 0) return

    let cancelled = false
    ;(async () => {
      setItensSearchLoading(true)
      try {
        const prodRows = produtos.length > 0 ? produtos : await fetchCrmProdutos().catch(() => [])
        const servRows = servicos.length > 0 ? servicos : await fetchCrmServicos().catch(() => [])
        if (!cancelled) {
          if (produtos.length === 0 && prodRows.length > 0) setProdutos(prodRows)
          if (servicos.length === 0 && servRows.length > 0) setServicos(servRows)
        }

        const prodMap = new Map<string, string>()
        const prodCodeMap = new Map<string, string>()
        for (const p of prodRows || []) {
          const id = String((p as any)?.prod_id || '').trim()
          if (!id) continue
          const code = String((p as any)?.codigo_prod || '').trim()
          if (code) prodCodeMap.set(id, code)
          const txt = `${String((p as any)?.codigo_prod || '').trim()} ${String((p as any)?.descricao_prod || '').trim()}`
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
          if (txt) prodMap.set(id, txt)
        }

        const servMap = new Map<string, string>()
        const servCodeMap = new Map<string, string>()
        for (const s of servRows || []) {
          const id = String((s as any)?.serv_id || '').trim()
          if (!id) continue
          const code = String((s as any)?.codigo_serv || '').trim()
          if (code) servCodeMap.set(id, code)
          const txt = `${String((s as any)?.codigo_serv || '').trim()} ${String((s as any)?.descricao_serv || '').trim()}`
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
          if (txt) servMap.set(id, txt)
        }

        const ids = (opportunities || [])
          .map((o) => String((o as any)?.id_oport ?? (o as any)?.id_oportunidade ?? '').trim())
          .filter(Boolean)

        const acc: Record<string, Set<string>> = {}
        const chunkSize = 200
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize)
          const { data, error } = await (supabase as any)
            .from('crm_oportunidade_itens')
            .select('id_oport, produto_id, servico_id')
            .in('id_oport', chunk)
          if (error) throw error
          for (const r of (data || []) as any[]) {
            const oportId = String(r?.id_oport || '').trim()
            if (!oportId) continue
            if (!acc[oportId]) acc[oportId] = new Set<string>()
            const prodId = String(r?.produto_id || '').trim()
            const servId = String(r?.servico_id || '').trim()
            if (prodId) acc[oportId].add(`p:${prodId}`)
            if (servId) acc[oportId].add(`s:${servId}`)
          }
        }

        const index: Record<string, string> = {}
        const display: Record<string, string> = {}
        for (const id of ids) {
          const set = acc[id]
          if (!set || set.size === 0) continue
          const parts: string[] = []
          const codes: string[] = []
          for (const ref of set) {
            const [kind, raw] = ref.split(':')
            if (kind === 'p' && raw) {
              const txt = prodMap.get(raw)
              if (txt) parts.push(txt)
              const code = prodCodeMap.get(raw)
              if (code) codes.push(code)
            }
            if (kind === 's' && raw) {
              const txt = servMap.get(raw)
              if (txt) parts.push(txt)
              const code = servCodeMap.get(raw)
              if (code) codes.push(code)
            }
            parts.push(ref)
          }
          const txt = parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()
          if (txt) index[id] = txt
          const uniqCodes = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)))
          if (uniqCodes.length > 0) display[id] = uniqCodes.join(', ')
        }

        if (!cancelled) {
          setItensSearchByOport(index)
          setItensDisplayByOport(display)
        }
      } finally {
        if (!cancelled) setItensSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchTerm, opportunities, produtos, servicos])

  const resolveStageId = useCallback(
    (op: CRM_Oportunidade) => {
      const stageIds = new Set(stages.map((s) => s.id))
      const rawStageId = String((op as any)?.id_fase || '').trim()
      if (rawStageId && stageIds.has(rawStageId)) return rawStageId
      const label = String((op as any)?.fase || '').trim()
      if (label) {
        const match = stages.find((s) => s.label === label)
        if (match) return match.id
      }
      return stages[0]?.id || FALLBACK_STAGES[0]!.id
    },
    [stages]
  )

  const resolveStatusId = useCallback(
    (op: CRM_Oportunidade) => {
      const raw = String((op as any)?.id_status || '').trim()
      if (raw) return raw
      const label = String((op as any)?.status || '').trim()
      if (!label) return ''
      const match = statuses.find((s) => String(s.status_desc || '').trim().toLowerCase() === label.toLowerCase())
      return match ? String(match.status_id || '').trim() : ''
    },
    [statuses]
  )

  const filteredOpportunities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const wantStatus = filterStatusId.trim()
    const wantFase = filterFaseId.trim()
    const wantsProduto = !!term && (/[0-9]/.test(term) || term.startsWith('#') || term.startsWith('p:') || term.startsWith('s:'))

    return (opportunities || []).filter((op) => {
      const id = String((op as any)?.id_oport ?? (op as any)?.id_oportunidade ?? '').trim()

      if (wantStatus) {
        const sid = resolveStatusId(op)
        if (!sid || sid !== wantStatus) return false
      }

      if (wantFase) {
        const fid = resolveStageId(op)
        if (!fid || fid !== wantFase) return false
      }

      if (term) {
        const clienteLabel =
          String((op as any)?.cliente_nome || op.cliente || '').trim() ||
          (op.id_cliente ? `Cliente #${String(op.id_cliente).split('-')[0]}` : '') ||
          ''
        const vendedorLabel = String((op as any)?.vendedor_nome || op.vendedor || '').trim()
        const solucaoLabel = formatSolucaoLabel(op.solucao).toLowerCase()
        const hay = `${clienteLabel} ${vendedorLabel} ${solucaoLabel}`.toLowerCase()
        const matchText = hay.includes(term)
        if (matchText) return true

        if (wantsProduto) {
          const legacy = `${String((op as any)?.cod_produto || '')} ${String((op as any)?.cod_servico || '')}`.toLowerCase()
          const idx = (itensSearchByOport[id] || '').toLowerCase()
          if (legacy.includes(term) || idx.includes(term)) return true
        }

        return false
      }

      return true
    })
  }, [opportunities, searchTerm, filterStatusId, filterFaseId, itensSearchByOport, resolveStageId, resolveStatusId])

  // Agrupamento por etapa
  const visibleStages = useMemo(() => {
    const want = filterFaseId.trim()
    if (!want) return stages
    const match = stages.find((s) => s.id === want)
    return match ? [match] : stages
  }, [stages, filterFaseId])

  const stageIds = new Set(visibleStages.map((s) => s.id))
  const defaultStageId = visibleStages[0]?.id || stages[0]?.id || FALLBACK_STAGES[0]!.id

  const columns = visibleStages
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
          const match = visibleStages.find(s => s.label === label) || stages.find(s => s.label === label)
          if (match) return match.id === stage.id
        }

        return stage.id === defaultStageId
      })
    }
  })

  // Cálculos de totais
  const totalValue = filteredOpportunities.reduce((acc, curr) => acc + getValorNumber(curr), 0)
  const totalCount = filteredOpportunities.length

  const listRows = useMemo(() => {
    const rows = (filteredOpportunities || []).map((op) => {
      const id = String((op as any)?.id_oport ?? (op as any)?.id_oportunidade ?? '').trim()
      const cod = String((op as any)?.cod_oport ?? (op as any)?.cod_oportunidade ?? '').trim()
      const codNum = cod ? Number.parseInt(cod.replace(/[^\d]/g, ''), 10) : NaN
      const clienteLabel =
        String((op as any)?.cliente_nome || op.cliente || '').trim() ||
        (op.id_cliente ? `Cliente #${String(op.id_cliente).split('-')[0]}` : '') ||
        '-'
      const statusDesc =
        String(
          statuses.find((s) => String(s.status_id) === String((op as any)?.id_status))?.status_desc ||
            (op as any)?.status_desc ||
            (op as any)?.status ||
            ''
        ).trim() || '-'
      const faseLabel = String(stages.find((s) => s.id === resolveStageId(op))?.label || (op as any)?.fase || '').trim() || '-'
      const vendedor = String((op as any)?.vendedor_nome || op.vendedor || '').trim() || '-'
      const valor = getValorNumber(op)
      const dataMov = String((op as any)?.data_parado ?? (op as any)?.data_alteracao ?? (op as any)?.atualizado_em ?? null)
      const diasSemMov = calcDaysSince(dataMov ? dataMov : null)
      return {
        id,
        cod,
        codNum,
        clienteLabel,
        solucaoLabel: formatSolucaoLabel(op.solucao),
        statusDesc,
        faseLabel,
        vendedor,
        valor,
        diasSemMov
      }
    })

    const { key, direction } = listSort
    const dir = direction === 'asc' ? 1 : -1
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const num = (v: unknown) => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : null
    }

    rows.sort((a, b) => {
      if (key === 'valor') return dir * ((a.valor || 0) - (b.valor || 0))
      if (key === 'diasSemMov') return dir * ((a.diasSemMov ?? -1) - (b.diasSemMov ?? -1))
      if (key === 'codigo') {
        const an = Number.isFinite(a.codNum) ? a.codNum : null
        const bn = Number.isFinite(b.codNum) ? b.codNum : null
        if (an !== null && bn !== null) return dir * (an - bn)
        return dir * norm(a.cod).localeCompare(norm(b.cod))
      }
      if (key === 'cliente') return dir * norm(a.clienteLabel).localeCompare(norm(b.clienteLabel))
      if (key === 'solucao') return dir * norm(a.solucaoLabel).localeCompare(norm(b.solucaoLabel))
      if (key === 'status') return dir * norm(a.statusDesc).localeCompare(norm(b.statusDesc))
      if (key === 'fase') return dir * norm(a.faseLabel).localeCompare(norm(b.faseLabel))
      if (key === 'vendedor') return dir * norm(a.vendedor).localeCompare(norm(b.vendedor))
      const av = num((a as any)[key])
      const bv = num((b as any)[key])
      if (av !== null && bv !== null) return dir * (av - bv)
      return 0
    })
    return rows
  }, [filteredOpportunities, listSort, statuses, stages, resolveStageId])

  const statusHistoryRows = useMemo(() => {
    const rows = (comentarios || [])
      .filter((c) => String((c as any)?.comentario || '').trim().toLowerCase().startsWith('status alterado:'))
      .map((c) => {
        const raw = String((c as any)?.comentario || '').trim()
        const lines = raw.split('\n')
        const first = String(lines[0] || '').trim()
        const statusText = first.replace(/^status alterado:\s*/i, '').trim() || '-'
        const rest = lines.slice(1).join('\n').trim()
        const comentarioText = rest.replace(/^(coment[aá]rio|obs)\s*:\s*/i, '').trim()
        return {
          id: String((c as any)?.comentario_id || '').trim() || `${(c as any)?.created_at || ''}-${Math.random()}`,
          when: String((c as any)?.created_at || '').trim(),
          createdBy: String((c as any)?.created_by || '').trim() || null,
          statusText,
          comentario: comentarioText || '-'
        }
      })
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    return rows
  }, [comentarios])

  useEffect(() => {
    if (!statusHistoryOpen) return
    const ids = Array.from(new Set(statusHistoryRows.map((r) => r.createdBy).filter(Boolean))) as string[]
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('id, nome, email_login, email_corporativo')
          .in('id', ids)
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data || []) as any[]) {
          const id = String(r?.id || '').trim()
          if (!id) continue
          map[id] = String(r?.nome || r?.email_corporativo || r?.email_login || id).trim()
        }
        setStatusHistoryUserById((prev) => ({ ...prev, ...map }))
      } catch {
        if (!cancelled) setStatusHistoryUserById((prev) => prev)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [statusHistoryOpen, statusHistoryRows])

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

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total em Pipeline</span>
            <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalValue)}</span>
          </div>
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Propostas Comerciais</span>
            <span className="text-sm font-bold text-slate-200">{totalCount}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl overflow-hidden border border-white/10 bg-[#0F172A]">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-2 text-xs font-black inline-flex items-center gap-2 transition-colors ${
                  viewMode === 'kanban' ? 'bg-cyan-600 text-white' : 'bg-transparent text-slate-200 hover:bg-white/5'
                }`}
                title="Visualizar em Kanban"
              >
                <LayoutDashboard size={14} />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('lista')}
                className={`px-3 py-2 text-xs font-black inline-flex items-center gap-2 transition-colors ${
                  viewMode === 'lista' ? 'bg-cyan-600 text-white' : 'bg-transparent text-slate-200 hover:bg-white/5'
                }`}
                title="Visualizar em Lista"
              >
                <List size={14} />
                Lista
              </button>
            </div>

            <select
              value={filterFaseId}
              onChange={(e) => setFilterFaseId(e.target.value)}
              className="h-[38px] rounded-xl bg-[#0F172A] border border-white/10 px-3 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              title="Filtrar por Fase"
            >
              <option value="">Todas as Fases</option>
              {stages
                .slice()
                .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>

            <select
              value={filterStatusId}
              onChange={(e) => setFilterStatusId(e.target.value)}
              className="h-[38px] rounded-xl bg-[#0F172A] border border-white/10 px-3 text-xs font-bold text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              title="Filtrar por Status"
            >
              <option value="">Todos os Status</option>
              {statuses
                .slice()
                .sort((a, b) => Number((a as any).status_ordem || 0) - Number((b as any).status_ordem || 0))
                .map((s) => (
                  <option key={String(s.status_id)} value={String(s.status_id)}>
                    {String(s.status_desc || '').trim() || `Status ${String(s.status_id).slice(0, 6)}`}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente ou código do produto..."
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
      </div>

      {viewMode === 'lista' ? (
        <div className="flex-1 min-h-0 rounded-2xl border border-white/5 bg-[#0F172A] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-widest text-slate-300">Lista de Propostas</div>
            {itensSearchLoading ? (
              <div className="text-[11px] text-slate-400 inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Buscando itens...
              </div>
            ) : null}
          </div>
          <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0B1220] border-b border-white/10">
                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                  {(
                    [
                      { key: 'codigo', label: 'Código', align: 'left' as const },
                      { key: 'cliente', label: 'Cliente', align: 'left' as const },
                      { key: 'solucao', label: 'Solução', align: 'left' as const },
                      { key: 'status', label: 'Status', align: 'left' as const },
                      { key: 'fase', label: 'Fase', align: 'left' as const },
                      { key: 'vendedor', label: 'Vendedor', align: 'left' as const },
                      { key: 'valor', label: 'Valor', align: 'right' as const },
                      { key: 'diasSemMov', label: 'Dias sem Movimentação', align: 'right' as const }
                    ] as const
                  ).map((c) => (
                    <th key={c.key} className={`px-4 py-3 font-black ${c.align === 'right' ? 'text-right' : ''}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setListSort((prev) => {
                            if (prev.key === c.key) return { key: c.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                            return { key: c.key, direction: c.key === 'valor' ? 'desc' : 'asc' }
                          })
                        }}
                        className="inline-flex items-center gap-2 hover:text-cyan-200 transition-colors"
                      >
                        <span>{c.label}</span>
                        <ArrowUpDown size={12} className={listSort.key === c.key ? 'text-cyan-300' : 'text-slate-500'} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listRows.map((r) => (
                  <tr
                    key={r.id || r.cod}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => (r.id ? openEdit(r.id) : null)}
                  >
                    <td className="px-4 py-3 text-xs font-black text-slate-200 whitespace-nowrap">{r.cod ? `#${r.cod}` : '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-200 max-w-[320px] truncate" title={r.clienteLabel}>
                      {r.clienteLabel}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-300 whitespace-nowrap">{r.solucaoLabel}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-200 max-w-[180px] truncate" title={r.statusDesc}>
                      {r.statusDesc}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-300 max-w-[180px] truncate" title={r.faseLabel}>
                      {r.faseLabel}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-300 max-w-[180px] truncate" title={r.vendedor}>
                      {r.vendedor}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-200 text-right whitespace-nowrap">{formatCurrency(r.valor)}</td>
                    <td className="px-4 py-3 text-xs font-black text-slate-200 text-right whitespace-nowrap">{formatDias(r.diasSemMov)}</td>
                  </tr>
                ))}

                {listRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      Nenhuma proposta encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
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
                                statusLabel={
                                  String(
                                    statuses.find((s) => String(s.status_id) === String((item as any).id_status))?.status_desc ||
                                      (item as any).status ||
                                      ''
                                  ).trim() || null
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
      )}

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
              disabled={createSubmitDisabled}
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
                    <>
                      <option value="">Selecione...</option>
                      {empresasCorrespondentes.map((e) => (
                        <option key={String(e.empresa_id)} value={String(e.empresa_id)}>
                          {String(e.nome_fantasia || e.razao_social || 'Empresa')}
                        </option>
                      ))}
                    </>
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
        zIndex={180}
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
                const clienteId = contatoModalClienteId.trim()
                const oportunidadeId = String(contatoModalOportunidadeId || '').trim()
                const nome = createContatoDraft.contato_nome.trim()
                const email = createContatoDraft.contato_email.trim()
                if (!clienteId) {
                  setCreateContatoError('Selecione um cliente para criar o contato.')
                  return
                }
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
                  setContatoOptions(refreshed)

                  if (oportunidadeId) {
                    try {
                      await linkOportunidadeContato({ oportunidadeId, contatoId: created.contato_id })
                      const shouldBecomePrincipal = !oportunidadeContatos.some((x) => x.isPrincipal) && oportunidadeContatos.length === 0
                      if (shouldBecomePrincipal) {
                        await setOportunidadeContatoPrincipal({ oportunidadeId, contatoId: created.contato_id })
                        await updateOportunidade(oportunidadeId, {
                          id_contato: created.contato_id,
                          contato_nome: created.contato_nome || null,
                          contato_cargo: created.contato_cargo || null,
                          contato_telefone01: created.contato_telefone01 || null,
                          contato_telefone02: created.contato_telefone02 || null,
                          contato_email: created.contato_email || null
                        } as any)
                        setDraftContatoId(created.contato_id)
                      }
                      setOportunidadeContatosReloadKey((prev) => prev + 1)
                      await loadData()
                    } catch {}
                  }

                  setOportunidadeContatos((prev) => {
                    if (!oportunidadeId) return prev
                    if (prev.some((p) => p.contatoId === created.contato_id)) return prev
                    const isPrincipal = prev.length === 0
                    return [...prev, { contatoId: created.contato_id, isPrincipal, contato: created }]
                  })
                  setOportunidadeContatosSelectedId(created.contato_id)
                  setCreateContatoModalOpen(false)
                } catch (e) {
                  setCreateContatoError(e instanceof Error ? e.message : 'Falha ao salvar contato.')
                } finally {
                  setCreateContatoSaving(false)
                }
              }}
              disabled={
                createContatoSaving || !contatoModalClienteId.trim() || !createContatoDraft.contato_nome.trim()
              }
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

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Cliente</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Nome/Razão Social</label>
                <input
                  value={contatoModalClienteNome || contatoModalClienteId.trim() || '-'}
                  readOnly
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">CNPJ/CPF</label>
                <input
                  value={contatoModalClienteDocumento || '-'}
                  readOnly
                  className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
          </div>

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
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-xl ${solucaoUi.iconBg} border ${solucaoUi.iconBorder} flex items-center justify-center`}>
                <LayoutDashboard size={16} className={solucaoUi.iconText} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{activeId ? 'Informações da Proposta Comercial' : 'Nova Proposta Comercial'}</span>
                <span className={`shrink-0 inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider border ${solucaoUi.badge}`}>
                  {solucaoUi.label}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatusHistoryError(null)
                  setStatusHistoryOpen(true)
                }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 inline-flex items-center justify-center transition-colors active:scale-[0.99]"
                title="Histórico de Status"
              >
                <Clock size={16} className="text-slate-200" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusChangeError(null)
                  setStatusChangeObs('')
                  setStatusChangeId(draftStatusId)
                  setStatusChangeOpen(true)
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs shadow-lg shadow-cyan-500/15 transition-all active:scale-[0.99]"
              >
                ANDAMENTO
              </button>
            </div>
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
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Código OMIE</label>
                          <input
                            value={
                              String(
                                (active as any)?.codigo_omie ||
                                  (active as any)?.cod_omie ||
                                  (active as any)?.id_omie ||
                                  (active as any)?.omie_id ||
                                  ''
                              ).trim() || '-'
                            }
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
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status Atual</label>
                          <input
                            value={String(statuses.find((s) => String(s.status_id) === String(draftStatusId))?.status_desc || '').trim() || '-'}
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
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">DATA</div>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Inclusão</label>
                          <input
                            value={dataInclusaoLabel}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dias Abertos</label>
                          <input
                            value={formatDias(diasAbertos)}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-black text-slate-100 outline-none font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Última Movimentação</label>
                          <input
                            value={ultimaMovimentacaoLabel}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dias sem Movimentação</label>
                          <input
                            value={formatDias(diasSemMovimentacao)}
                            readOnly
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-black text-slate-100 outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">Cliente / Contatos</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOportunidadeContatosError(null)
                              if (!draftClienteId.trim()) return
                              setContatoAddBarOpen((prev) => {
                                const next = !prev
                                if (next) setContatoAddOpen(true)
                                return next
                              })
                            }}
                            disabled={!draftClienteId.trim()}
                            className="h-[36px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-cyan-500/15 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            Adicionar Contato
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!draftClienteId.trim()) return
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
                              setContatoModalClienteId(draftClienteId.trim())
                              setContatoModalOportunidadeId(String(activeId || '').trim() || null)
                              setCreateContatoModalOpen(true)
                            }}
                            disabled={createContatoSaving || !draftClienteId.trim()}
                            className="h-[36px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-black text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
                          >
                            <UserPlus size={14} />
                            Novo Contato
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
                          <div className="xl:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cliente</label>
                            <input
                              value={clienteQuery}
                              readOnly
                              placeholder="Cliente"
                              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none"
                            />
                          </div>
                          <div className="xl:col-span-3 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">CNPJ/CPF</label>
                            <input
                              value={draftClienteDocumento || '-'}
                              readOnly
                              placeholder="CNPJ/CPF"
                              className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none font-mono"
                            />
                          </div>
                          <div className="xl:col-span-3 space-y-2">
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

                        <div className="h-px bg-white/10" />

                        {(oportunidadeContatosError || contatoAddBarOpen || oportunidadeContatosLoading || oportunidadeContatos.length > 0) && (
                          <>
                            {oportunidadeContatosError && (
                              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                                {oportunidadeContatosError}
                              </div>
                            )}

                            {contatoAddBarOpen && (
                              <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                  <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                      value={contatoAddQuery}
                                      onChange={(e) => {
                                        setContatoAddQuery(e.target.value)
                                        setContatoAddId('')
                                        setContatoAddOpen(true)
                                      }}
                                      onFocus={() => setContatoAddOpen(true)}
                                      onBlur={() => window.setTimeout(() => setContatoAddOpen(false), 150)}
                                      disabled={!draftClienteId.trim() || contatoLoading || oportunidadeContatosLoading}
                                      placeholder={contatoLoading ? 'Carregando...' : 'Pesquisar contato...'}
                                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 pl-9 pr-4 py-3 text-sm font-semibold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none disabled:opacity-40"
                                    />
                                    {contatoAddOpen && (
                                      <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/10 bg-[#0B1220] shadow-2xl overflow-hidden">
                                        <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                          {contatoAddFiltered.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-slate-400">Nenhum contato encontrado.</div>
                                          ) : (
                                            contatoAddFiltered.map((c) => (
                                              <button
                                                key={c.contato_id}
                                                type="button"
                                                onMouseDown={(ev) => {
                                                  ev.preventDefault()
                                                  setContatoAddId(c.contato_id)
                                                  setContatoAddQuery(c.contato_nome)
                                                  setContatoAddOpen(false)
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                                              >
                                                <div className="text-sm font-semibold text-slate-100 truncate">{c.contato_nome}</div>
                                                <div className="text-[11px] text-slate-400 truncate">
                                                  {(c.contato_cargo || '-') +
                                                    ' · ' +
                                                    (c.contato_email || '-') +
                                                    ' · ' +
                                                    (c.contato_telefone01 || '-')}
                                                </div>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={addContatoToProposta}
                                    disabled={contatoOpsSaving || !contatoAddId.trim() || !draftClienteId.trim()}
                                    className="h-[46px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/15 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="rounded-2xl border border-white/10 bg-[#0F172A] overflow-hidden">
                              <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between gap-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Contatos</div>
                                <span className="text-[10px] font-black bg-white/5 text-slate-300 px-2 py-1 rounded-full border border-white/10">
                                  {oportunidadeContatos.length}
                                </span>
                              </div>

                              <div className="hidden xl:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10">
                                <div className="col-span-1">#</div>
                                <div className="col-span-3">Contato</div>
                                <div className="col-span-3">Cargo</div>
                                <div className="col-span-3">E-mail</div>
                                <div className="col-span-1">Telefone</div>
                                <div className="col-span-1 text-right">Ações</div>
                              </div>

                              {oportunidadeContatosLoading ? (
                                <div className="px-4 py-4 text-xs text-slate-400 flex items-center gap-2">
                                  <Loader2 className="animate-spin" size={14} />
                                  Carregando contatos...
                                </div>
                              ) : oportunidadeContatos.length === 0 ? (
                                <div className="px-4 py-4 text-xs text-slate-400">Nenhum contato vinculado ainda.</div>
                              ) : (
                                <div className="divide-y divide-white/10">
                                  {oportunidadeContatos.map((c, idx) => (
                                    <div key={c.contatoId} className="px-4 py-3 grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
                                      <div className="xl:col-span-1 text-xs font-black text-slate-300">{idx + 1}</div>
                                      <div className="xl:col-span-3 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {c.isPrincipal && <Star size={14} className="text-amber-300 shrink-0" />}
                                          <div className="text-sm font-bold text-slate-100 truncate">
                                            {c.contato?.contato_nome || `Contato ${idx + 1}`}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="xl:col-span-3 text-sm font-semibold text-slate-200 truncate">
                                        {c.contato?.contato_cargo || '-'}
                                      </div>
                                      <div className="xl:col-span-3 text-sm font-semibold text-slate-200 truncate">
                                        {c.contato?.contato_email || '-'}
                                      </div>
                                      <div className="xl:col-span-1 text-sm font-semibold text-slate-200 truncate font-mono">
                                        {c.contato?.contato_telefone01 || '-'}
                                      </div>
                                      <div className="xl:col-span-1 flex items-center justify-start xl:justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setContatoPrincipalOnProposta(c.contatoId)}
                                          disabled={contatoOpsSaving || c.isPrincipal}
                                          title="Definir como principal"
                                          className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center"
                                        >
                                          <LogIn size={16} className="text-amber-300" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeContatoFromProposta(c.contatoId)}
                                          disabled={contatoOpsSaving}
                                          className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-rose-200 transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center"
                                          title="Remover"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
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
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Número do Pedido de Compra</label>
                          <Pencil size={12} className="text-slate-500" />
                        </div>
                        <input
                          value={draftPedidoCompraNumero}
                          onChange={(e) => setDraftPedidoCompraNumero(e.target.value)}
                          placeholder="Número do pedido de compra..."
                          className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Arquivo do Pedido de Compra</label>
                        </div>
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
                          {pedidoCompraUploading ? 'Anexando...' : 'Anexar Arquivo'}
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
                      { id: 'pagamento', label: 'Pagamento', editable: true },
                      { id: 'temperatura', label: 'Temperatura', editable: true },
                      { id: 'comentarios', label: 'Comentários', editable: true },
                      { id: 'observacoes', label: 'Observações', editable: true },
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
                {tab === 'pagamento' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                          className="w-full px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/15 transition-all active:scale-[0.99]"
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
                          className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-500/15 transition-all active:scale-[0.99]"
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
                            className="w-full px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/15 transition-all active:scale-[0.99]"
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
                            className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-500/15 transition-all active:scale-[0.99]"
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

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Validade da Proposta</div>
                        <input
                          type="date"
                          value={draftValidadeProposta}
                          onChange={(e) => setDraftValidadeProposta(e.target.value)}
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
                            onChange={(e) => {
                              const next = e.target.value
                              setDraftCondicaoPagamentoId(next)
                              const days = getCondicaoPrazoDias(next)
                              if (days === null) return
                              setDraftPrevEntrega(addDaysToDateInput(new Date(), days))
                            }}
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
                            onChange={(e) => {
                              const raw = e.target.value
                              const cleaned = String(raw || '').replace(',', '.').replace(/[^\d.]/g, '')
                              if (!cleaned) {
                                setDraftDescontoPropostaPercent('')
                                return
                              }
                              const v = Number.parseFloat(cleaned)
                              if (!Number.isFinite(v)) return
                              setDraftDescontoPropostaPercent(String(Math.min(100, Math.max(0, v))))
                            }}
                            disabled={paymentsSchemaOk === false}
                            inputMode="decimal"
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Tipo de Frete</label>
                          <select
                            value={draftTipoFrete}
                            onChange={(e) => setDraftTipoFrete(e.target.value as any)}
                            disabled={paymentsSchemaOk === false}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none"
                          >
                            <option value="">-</option>
                            <option value="FOB">FOB</option>
                            <option value="CIF">CIF</option>
                          </select>
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
                                      it.tipo === 'PRODUTO' ? 'bg-orange-500/15 text-orange-200 border border-orange-500/30' : 'bg-blue-500/15 text-blue-200 border border-blue-500/30'
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
                                        markDraftItensTouched()
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
                                        markDraftItensTouched()
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
                                      onClick={() => {
                                        markDraftItensTouched()
                                        setDraftItens((prev) => prev.filter((x) => x.localId !== it.localId))
                                      }}
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

                {tab === 'temperatura' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase tracking-widest text-slate-300">Fechamento</div>
                          <div className="mt-1 text-[11px] text-slate-400">Previsão (dia/mês/ano)</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Fechamento (dia/mês/ano)</label>
                          <input
                            type="date"
                            value={draftPrevFechamento}
                            onChange={(e) => setDraftPrevFechamento(e.target.value)}
                            className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                      {(() => {
                        const raw = String(draftTemperatura || '').trim()
                        const n0 = raw ? Number.parseInt(raw, 10) : 0
                        const temp = Number.isFinite(n0) ? Math.min(100, Math.max(0, n0)) : 0
                        const bucket = temp <= 30 ? 'FRIA' : temp <= 60 ? 'MORNA' : temp <= 85 ? 'QUENTE' : 'MUITO QUENTE'
                        const bucketColor =
                          bucket === 'FRIA'
                            ? 'text-sky-200 bg-sky-500/10 border-sky-500/20'
                            : bucket === 'MORNA'
                              ? 'text-amber-200 bg-amber-500/10 border-amber-500/20'
                              : bucket === 'QUENTE'
                                ? 'text-orange-200 bg-orange-500/10 border-orange-500/20'
                                : 'text-rose-200 bg-rose-500/10 border-rose-500/20'
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-300">Temperatura da Proposta</div>
                                <div className="mt-1 text-[11px] text-slate-400">Probabilidade por faixa</div>
                              </div>
                              <div className={`shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[11px] font-black ${bucketColor}`}>
                                <span>{`🌡${temp}º`}</span>
                                <span className="hidden sm:inline">{bucket}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={temp}
                                onChange={(e) => setDraftTemperatura(String(e.target.value))}
                                className="w-full"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Temperatura (%)</label>
                                  <input
                                    value={draftTemperatura}
                                    onChange={(e) => setDraftTemperatura(e.target.value)}
                                    inputMode="numeric"
                                    className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none font-mono"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Faixa</label>
                                  <input
                                    value={bucket}
                                    readOnly
                                    className={`w-full rounded-xl bg-[#0F172A] border px-4 py-3 text-sm font-black outline-none ${bucketColor}`}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-[#0F172A] overflow-hidden">
                              <div className="grid grid-cols-[1.3fr_1fr_0.9fr_1.3fr] gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10">
                                <div>Temperatura</div>
                                <div>Prob.</div>
                                <div>Cor</div>
                                <div>Uso</div>
                              </div>
                              {[
                                { t: 'Fria', p: '0–30%', c: 'Azul', u: 'Pouco provável', badge: 'text-sky-200 bg-sky-500/10 border-sky-500/20' },
                                { t: 'Morna', p: '31–60%', c: 'Amarelo', u: 'Em negociação', badge: 'text-amber-200 bg-amber-500/10 border-amber-500/20' },
                                { t: 'Quente', p: '61–85%', c: 'Laranja', u: 'Alta chance', badge: 'text-orange-200 bg-orange-500/10 border-orange-500/20' },
                                { t: 'Muito Quente', p: '86–100%', c: 'Vermelho', u: 'Fechamento iminente', badge: 'text-rose-200 bg-rose-500/10 border-rose-500/20' }
                              ].map((r) => (
                                <div key={r.t} className="grid grid-cols-[1.3fr_1fr_0.9fr_1.3fr] gap-2 px-4 py-2 text-[11px] text-slate-200 border-b border-white/5 last:border-b-0">
                                  <div className="font-black">{r.t}</div>
                                  <div className="text-slate-300 font-mono">{r.p}</div>
                                  <div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black ${r.badge}`}>
                                      {r.c}
                                    </span>
                                  </div>
                                  <div className="text-slate-300">{r.u}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
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
                              } else if (a.tipo === 'ALTEROU_STATUS') {
                                title = 'Status alterado'
                                const fromDesc = statuses.find((s) => String(s.status_id) === String(p?.de || ''))?.status_desc || String(p?.de || '-')
                                const toDesc = statuses.find((s) => String(s.status_id) === String(p?.para || ''))?.status_desc || String(p?.para || '-')
                                detail = `${fromDesc} → ${toDesc}`
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
              </div>
            </div>

            <div className="w-full border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0B1220] px-4 md:px-6 py-4 md:py-6 lg:sticky lg:top-0 lg:self-start">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    if (saveUiState !== 'dirty') return
                    void handleSave()
                  }}
                  disabled={saveUiState !== 'dirty'}
                  className={`w-full px-6 py-3 rounded-xl font-black text-sm transition-all inline-flex items-center justify-center gap-2 ${
                    saveUiState === 'saved'
                      ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/15 active:scale-[0.99]'
                  } ${saveUiState !== 'dirty' ? 'opacity-60 pointer-events-none shadow-none' : ''}`}
                >
                  {saveUiState === 'saving' ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      SALVANDO...
                    </>
                  ) : saveUiState === 'saved' ? (
                    <>
                      <Check size={16} />
                      SALVO
                    </>
                  ) : (
                    'SALVAR ALTERAÇÕES'
                  )}
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={!canGenerateProposta}
                      onClick={() => {
                        void handleGerarProposta()
                      }}
                      className={`w-full px-4 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.99] ${
                        canGenerateProposta
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/15'
                          : 'bg-white/5 border border-white/10 text-slate-400 cursor-not-allowed'
                      }`}
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
                      className="w-full px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-sm shadow-lg shadow-violet-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
                    >
                      Transferir Proposta
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
                      className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-500/15 transition-all active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
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
          onClose={() => {
            if (generatePdfLoading) return
            setGenerateOpen(false)
            setGenerateOportunidadeId(null)
            setGeneratePreparing(false)
            setGenerateShowValores(true)
          }}
          title="Proposta"
          size="sm"
          zIndex={210}
          footer={
            <>
              <button
                type="button"
                disabled={!generateOportunidadeId || generatePdfLoading || generatePreparing}
                onClick={async () => {
                  const oportunidadeId = String(generateOportunidadeId || '').trim()
                  if (!oportunidadeId) return
                  setGeneratePdfLoading(true)
                  setGeneratePdfError(null)
                  try {
                    if (isDirty) await handleSave({ skipStatusObsCheck: true })
                    await downloadPropostaPdf({
                      oportunidadeId,
                      validade: draftValidadeProposta.trim() || null,
                      tipoFrete: draftTipoFrete || null,
                      showValores: generateShowValores
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
                  'BAIXAR PDF'
                )}
              </button>
              <button
                type="button"
                disabled={!generateOportunidadeId || generatePdfLoading || generatePreparing}
                onClick={async () => {
                  const oportunidadeId = String(generateOportunidadeId || '').trim()
                  if (!oportunidadeId) return
                  setGeneratePdfLoading(true)
                  setGeneratePdfError(null)
                  try {
                    if (isDirty) await handleSave({ skipStatusObsCheck: true })
                    await openPropostaPdfInNewTab({
                      oportunidadeId,
                      validade: draftValidadeProposta.trim() || null,
                      tipoFrete: draftTipoFrete || null,
                      showValores: generateShowValores
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
                VISUALIZAR PDF
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipo de Proposta</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={generatePdfLoading || generatePreparing}
                  onClick={() => setGenerateShowValores(true)}
                  className={`px-4 py-3 rounded-xl border text-sm font-black transition-colors disabled:opacity-50 ${
                    generateShowValores
                      ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500/30 text-white'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-100'
                  }`}
                >
                  Com Valor
                </button>
                <button
                  type="button"
                  disabled={generatePdfLoading || generatePreparing}
                  onClick={() => setGenerateShowValores(false)}
                  className={`px-4 py-3 rounded-xl border text-sm font-black transition-colors disabled:opacity-50 ${
                    !generateShowValores
                      ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-500/30 text-white'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-100'
                  }`}
                >
                  Sem Valor
                </button>
              </div>
              <div className="text-[11px] text-slate-400">
                {generateShowValores ? 'Gera proposta comercial com valores.' : 'Gera proposta técnica sem valores.'}
              </div>
            </div>
            {generatePdfError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{generatePdfError}</div>
            ) : null}
            {generatePreparing ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} />
                Preparando proposta...
              </div>
            ) : null}
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
          isOpen={statusHistoryOpen}
          onClose={() => setStatusHistoryOpen(false)}
          title={
            <div className="inline-flex items-center gap-2">
              <Clock size={16} className="text-cyan-300" />
              Histórico de Status
            </div>
          }
          size="lg"
          zIndex={215}
        >
          <div className="space-y-4">
            {statusHistoryError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{statusHistoryError}</div>
            ) : null}

            {!activeId ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                Salve a proposta para ver o histórico de status.
              </div>
            ) : statusHistoryRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                Nenhuma alteração de status registrada.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-auto custom-scrollbar max-h-[65vh]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-[#0B1220] border-b border-white/10">
                      <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3 font-black">Status</th>
                        <th className="px-4 py-3 font-black whitespace-nowrap">Data/Hora</th>
                        <th className="px-4 py-3 font-black">Usuário</th>
                        <th className="px-4 py-3 font-black">Comentário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusHistoryRows.map((r) => (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="px-4 py-3 text-xs font-black text-slate-200 whitespace-nowrap">{r.statusText}</td>
                          <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {r.when ? new Date(r.when).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-200 max-w-[220px] truncate" title={r.createdBy || undefined}>
                            {r.createdBy ? statusHistoryUserById[r.createdBy] || r.createdBy : '-'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-300 whitespace-pre-wrap">{r.comentario}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={statusChangeOpen}
          onClose={() => setStatusChangeOpen(false)}
          title="Andamento"
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
                    setStatusChangeError('Selecione um status.')
                    return
                  }
                  const obs = statusChangeObs.trim()
                  if (!obs) {
                    setStatusChangeError('Informe um comentário.')
                    return
                  }
                  setStatusChangeError(null)
                  setDraftStatusId(next)
                  setStatusChangeOpen(false)
                  await handleSave({ statusIdOverride: next, skipStatusObsCheck: true, statusObs: obs })
                }}
                className="px-7 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/15 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                Aplicar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {statusChangeError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{statusChangeError}</div>
            ) : null}
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
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1">Comentário</label>
              <textarea
                value={statusChangeObs}
                onChange={(e) => setStatusChangeObs(e.target.value)}
                className="w-full h-24 rounded-xl bg-[#0F172A] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all outline-none resize-none placeholder:text-slate-500"
                placeholder="Descreva o andamento..."
              />
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

                  markDraftItensTouched()
                  setDraftItens((prev) => [...prev, next])
                  setItemSelectedId('')
                  setItemQuantidade('1')
                  setItemDesconto('0')
                }}
                disabled={!itemSelected}
                className={`px-7 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 ${
                  itemModalTipo === 'PRODUTO'
                    ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/15'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/15'
                }`}
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
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setItemSelectedId(String(opt.id))}
                      className={`w-full text-left px-4 py-3 transition-colors border-b border-white/5 ${
                        String(itemSelectedId) === String(opt.id)
                          ? itemModalTipo === 'PRODUTO'
                            ? 'bg-orange-500/10'
                            : 'bg-blue-500/10'
                          : 'hover:bg-white/5'
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
