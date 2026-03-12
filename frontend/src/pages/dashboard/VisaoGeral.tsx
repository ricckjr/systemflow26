import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  TrendingUp,
  Award,
  RefreshCw,
  X,
  Ban,
  Percent,
  ShoppingCart,
  FileText,
  Phone,
  Settings,
  Target,
  Save,
  Loader2,
  Maximize2,
  Minimize2,
  Factory,
  Star,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts'
import { startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns'
import { parseValorProposta, formatCurrency, parseDate } from '@/utils/comercial/format'
import { isVenda, isAtivo, CRM_Oportunidade } from '@/services/crm'
import { useOportunidades, usePabxLigacoes, useInvalidateCRM, useMeta, useUpdateMeta } from '@/hooks/useCRM'
import { APP_TIME_ZONE } from '@/constants/timezone'
import { formatTimeBR } from '@/utils/datetime'
import { Modal } from '@/components/ui'
import { useTvMode } from '@/hooks/useTvMode'
import FunnelVendas from '@/components/crm/FunilVendas'
import { FeedVendasMes } from '@/components/dashboard/FeedVendasMes'
import ErrorBoundary from '@/components/ErrorBoundary'

/* ===========================
   HELPERS
=========================== */
function getYearMonth(d: CRM_Oportunidade) {
  const raw = d.data || d.data_inclusao
  const dateObj = parseDate(raw)
  if (!dateObj) return null
  return [String(dateObj.getFullYear()), String(dateObj.getMonth() + 1).padStart(2, '0')]
}

export default function VisaoGeral() {
  // React Query Hooks
  const { 
    data: oportunidadesData, 
    isLoading: isLoadingOps,
    dataUpdatedAt: opsUpdatedAt 
  } = useOportunidades()
  
  const { 
    data: pabxLigacoesData, 
    isLoading: isLoadingPabx
  } = usePabxLigacoes()

  const { data: meta } = useMeta()
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false)
  
  const invalidateCRM = useInvalidateCRM()
  const dashboardRef = useRef<HTMLDivElement | null>(null)
  const { isTvMode, isRequestingFullscreen, toggleTvMode, exitTvMode } = useTvMode()
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  
  // Derived state
  const data = oportunidadesData || []
  const pabxLigacoes = pabxLigacoesData || []
  const lastUpdated = opsUpdatedAt ? new Date(opsUpdatedAt) : new Date()

  const handleRefresh = async () => {
    try {
      setIsManualRefreshing(true)
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 800))
      await Promise.all([invalidateCRM(), minLoadTime])
    } catch (error) {
      console.error("Failed to refresh CRM data", error)
    } finally {
      setIsManualRefreshing(false)
    }
  }

  useEffect(() => {
    if (isTvMode) setIsMetaModalOpen(false)
  }, [isTvMode])

  /* ===========================
     STATS CALCULATION
  ============================ */
  const stats = useMemo(() => {
    // Force "America/Sao_Paulo" timezone for current month calculation
    const now = new Date()
    const spDate = new Date(now.toLocaleString('en-US', { timeZone: APP_TIME_ZONE }))
    
    const start = startOfMonth(spDate)
    const end = endOfMonth(spDate)
    const prevStart = startOfMonth(subMonths(spDate, 1))
    const prevEnd = endOfMonth(subMonths(spDate, 1))

    // CONSTANTS
    const STATUS_VENDAS = 'c8535d23-d002-4dbd-9bbe-9be97c2097ba'
    const STATUS_PIPELINE_ATIVO = 'd2649868-1c22-49bd-ac81-56b6a0e7aff7'
    const STATUS_PERDIDO = 'c684a1c0-83ea-4b78-be4f-416cafa282c8'
    const FASE_EM_PRODUCAO = '7a51b000-774c-4020-874b-30c2f934e4f9'
    const FASE_POS_VENDA = '608e0e07-d5cc-4f9a-93a6-dcaaf9568963'

    // Helper: Sum Value
    const sumValue = (list: CRM_Oportunidade[]) => list.reduce(
        (a, o) => a + parseValorProposta(o.valor_proposta ?? (o.ticket_valor == null ? null : String(o.ticket_valor))),
        0
    )

    // 1. Propostas Geradas (Data Inclusão - Mês Atual)
    const getPropostas = (s: Date, e: Date) => data.filter(d => {
        const date = parseDate(d.data_inclusao)
        return date && isWithinInterval(date, { start: s, end: e })
    })
    const propostasCurr = getPropostas(start, end)
    const propostasLast = getPropostas(prevStart, prevEnd)

    // 2. Vendas (Data Conquistado - Mês Atual + Status ID)
    const getVendas = (s: Date, e: Date) => data.filter(d => {
        if (d.id_status !== STATUS_VENDAS) return false
        const date = parseDate(d.data_conquistado)
        return date && isWithinInterval(date, { start: s, end: e })
    })
    const vendasCurr = getVendas(start, end)
    const vendasLast = getVendas(prevStart, prevEnd)

    // 3. Pipeline Ativo (Total - Status ID)
    const pipelineAtivo = data.filter(d => d.id_status === STATUS_PIPELINE_ATIVO)

    // 4. Perdidas (Total - Status ID)
    const perdidasTotal = data.filter(d => d.id_status === STATUS_PERDIDO)

    // 5. Em Produção (Total - Fase ID)
    const emProducao = data.filter(d => d.id_fase === FASE_EM_PRODUCAO)

    // 6. Pós Venda (Total - Fase ID)
    const posVenda = data.filter(d => d.id_fase === FASE_POS_VENDA)

    // Helper: Calculate Trend
    const calcTrend = (curr: number, last: number) => {
        if (last === 0) return curr > 0 ? 100 : 0
        return ((curr - last) / last) * 100
    }

    // Metrics Calculation
    const vendaVal = sumValue(vendasCurr)
    const vendaCount = vendasCurr.length
    const vendaLastVal = sumValue(vendasLast)

    const propCount = propostasCurr.length
    const propLastCount = propostasLast.length

    const pipelineVal = sumValue(pipelineAtivo)
    const pipelineCount = pipelineAtivo.length

    const perdidasVal = sumValue(perdidasTotal)
    const perdidasCount = perdidasTotal.length

    // Conversion (Vendas / Propostas)
    const conversionCurr = propCount > 0 ? (vendaCount / propCount) * 100 : 0
    const conversionLast = propLastCount > 0 ? (vendasLast.length / propLastCount) * 100 : 0

    // Avg Ticket (Vendas Val / Vendas Count)
    const ticketCurr = vendaCount > 0 ? vendaVal / vendaCount : 0
    const ticketLast = vendasLast.length > 0 ? vendaLastVal / vendasLast.length : 0

    // Ligações (PABX)
    const calculateCallStats = (s: Date, e: Date) => pabxLigacoes.reduce((acc, l) => {
       const d = parseDate(l.id_data)
       if (!d) return acc
       if (isWithinInterval(d, { start: s, end: e })) {
         return {
           total: acc.total + (l.total_ligacoes_realizadas || 0),
           atendidas: acc.atendidas + (l.ligacoes_atendidas || 0),
           naoAtendidas: acc.naoAtendidas + (l.ligacoes_nao_atendidas || 0),
           falhadas: acc.falhadas + (l.ligacoes_falhadas || 0)
         }
       }
       return acc
    }, { total: 0, atendidas: 0, naoAtendidas: 0, falhadas: 0 })

    const callsCurr = calculateCallStats(start, end)
    const callsLast = calculateCallStats(prevStart, prevEnd)

    const emProducaoVal = sumValue(emProducao)
    const emProducaoCount = emProducao.length
    const posVendaVal = sumValue(posVenda)
    const posVendaCount = posVenda.length

    return {
      venda: { value: vendaVal, count: vendaCount, trend: calcTrend(vendaVal, vendaLastVal) },
      ativo: { value: pipelineVal, count: pipelineCount, trend: 0 },
      perdido: { value: perdidasVal, count: perdidasCount, trend: 0 },
      emProducao: { value: emProducaoVal, count: emProducaoCount, trend: 0 },
      posVenda: { value: posVendaVal, count: posVendaCount, trend: 0 },
      conversion: {
        value: conversionCurr,
        trend: calcTrend(conversionCurr, conversionLast)
      },
      avgTicket: {
        value: ticketCurr,
        trend: calcTrend(ticketCurr, ticketLast)
      },
      propostasGeradas: { value: propCount, trend: calcTrend(propCount, propLastCount) },
      ligacoesFeitas: { value: callsCurr.total, trend: calcTrend(callsCurr.total, callsLast.total) },
      ligacoesAtendidas: { value: callsCurr.atendidas, trend: calcTrend(callsCurr.atendidas, callsLast.atendidas) },
      ligacoesNaoAtendidas: { value: callsCurr.naoAtendidas, trend: calcTrend(callsCurr.naoAtendidas, callsLast.naoAtendidas) },
      ligacoesFalhadas: { value: callsCurr.falhadas, trend: calcTrend(callsCurr.falhadas, callsLast.falhadas) }
    }
  }, [data, pabxLigacoes])

  if ((isLoadingOps || isLoadingPabx) && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--primary)] animate-pulse">
        <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
        <p className="text-sm font-medium tracking-widest uppercase">Carregando Dashboard...</p>
      </div>
    )
  }

  return (
    <div
      ref={dashboardRef}
      className={`relative animate-in fade-in duration-700 ${isTvMode ? 'h-full w-full overflow-auto p-6 space-y-6' : 'space-y-6'}`}
    >
      {/* HEADER ACTIONS */}
      {!isTvMode && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Comercial</h1>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMetaModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all duration-300 font-medium text-sm shadow-sm"
            >
              <Target size={18} />
              <span>Definir Meta</span>
            </button>

            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRefresh();
              }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 active:scale-95 transition-all duration-300 font-medium text-sm shadow-sm shadow-indigo-500/20 cursor-pointer select-none"
            title={`Última atualização: ${formatTimeBR(lastUpdated)}`}
            disabled={isManualRefreshing}
            style={{ position: 'relative', zIndex: 100 }}
          >
            <RefreshCw size={18} className={isManualRefreshing ? "animate-spin" : ""} />
            <span>{isManualRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>

            <button
              type="button"
              onClick={() => toggleTvMode()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all duration-300 font-medium text-sm shadow-sm"
              disabled={isRequestingFullscreen}
            >
              <Maximize2 size={18} />
              <span>Modo TV</span>
            </button>
          </div>
        </div>
      )}

      {isTvMode && (
        <div className="fixed top-4 right-4 z-[300] flex items-center gap-3">
          <button
            type="button"
            onClick={() => exitTvMode()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-panel)]/90 backdrop-blur border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all duration-300 font-semibold text-sm shadow-lg"
          >
            <Minimize2 size={18} />
            <span>Sair da Tela Cheia</span>
          </button>
        </div>
      )}

      {/* CONTENT WRAPPER WITH OVERLAY */}
      <div className={`relative ${isTvMode ? 'h-full' : 'min-h-[500px]'}`}>
        <div className="space-y-6">
          {/* KPIS GRID - 2 Rows of 4 Cards for TV Readability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI 
          title="Ligações Feitas" 
          value={String(stats.ligacoesFeitas.value)} 
          trend={stats.ligacoesFeitas.trend}
          icon={Phone}
          color="blue"
        />
        <KPI 
          title="Ligações Atendidas" 
          value={String(stats.ligacoesAtendidas.value)} 
          trend={stats.ligacoesAtendidas.trend}
          icon={Phone}
          color="emerald"
        />
        <KPI 
          title="Ligações Não Atendidas" 
          value={String(stats.ligacoesNaoAtendidas.value)} 
          trend={stats.ligacoesNaoAtendidas.trend}
          icon={Phone}
          color="amber"
        />
        <KPI 
          title="Ligações Falhadas" 
          value={String(stats.ligacoesFalhadas.value)} 
          trend={stats.ligacoesFalhadas.trend}
          icon={Phone}
          color="rose"
        />
        
        {/* Row 2 */}
        <KPI 
          title="Propostas Geradas" 
          value={String(stats.propostasGeradas.value)} 
          trend={stats.propostasGeradas.trend}
          icon={FileText}
          color="indigo"
        />
        <KPI 
          title="Vendas (Mês)" 
          value={formatCurrency(stats.venda.value)} 
          count={stats.venda.count}
          trend={stats.venda.trend}
          icon={Award}
          color="amber"
          isMain
        />
        <KPI 
          title="Pipeline Ativo" 
          value={formatCurrency(stats.ativo.value)} 
          count={stats.ativo.count}
          trend={stats.ativo.trend}
          icon={TrendingUp}
          color="sky"
        />
        <KPI 
          title="Ticket Médio" 
          value={formatCurrency(stats.avgTicket.value)} 
          trend={stats.avgTicket.trend}
          icon={ShoppingCart}
          color="emerald"
        />
        
        {/* Row 3 */}
        <KPI 
          title="Taxa de Conversão" 
          value={`${stats.conversion.value.toFixed(1)}%`} 
          trend={stats.conversion.trend}
          icon={Percent}
          color="violet"
        />
        <KPI
          title="Perdidas (Total)"
          value={formatCurrency(stats.perdido.value)}
          count={stats.perdido.count}
          trend={stats.perdido.trend}
          icon={Ban}
          invertTrend
          color="rose"
        />
        <KPI
          title="Em Produção"
          value={String(stats.emProducao.count)}
          trend={stats.emProducao.trend}
          icon={Factory}
          color="violet"
        />
        <KPI
          title="Pós Venda"
          value={String(stats.posVenda.count)}
          trend={stats.posVenda.trend}
          icon={Star}
          color="sky"
        />
      </div>

      {/* META PROGRESS BAR */}
      <div className="mb-6">
        <MetaProgressBar 
          current={stats.venda.value} 
          target={meta?.supermeta_valor_financeiro ? Number(meta.supermeta_valor_financeiro) : 0} 
          label="Meta Comercial"
          onClick={() => setIsMetaModalOpen(true)}
        />
      </div>

      {/* MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
        {/* FUNIL - Takes 7 cols */}
        <div className="xl:col-span-7 h-full">
          <FunnelSection data={data} onRefresh={invalidateCRM} />
        </div>

        {/* RANKING - Takes 5 cols */}
        <div className="xl:col-span-5 h-full">
          <ErrorBoundary
            fallback={
              <div className="bg-[var(--bg-panel)] rounded-lg shadow-sm border border-[var(--border)] flex flex-col h-full min-h-[400px] p-6 items-center justify-center text-center">
                <div className="text-sm text-[var(--text-main)] font-semibold">Falha ao renderizar o feed</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">O restante do dashboard continua funcionando.</div>
              </div>
            }
          >
            <FeedVendasMes />
          </ErrorBoundary>
        </div>
      </div>
      
      </div>
    </div>

      <MetaModal 
        isOpen={isMetaModalOpen} 
        onClose={() => setIsMetaModalOpen(false)} 
        meta={meta} 
      />
    </div>
  )
}

/* ===========================
   KPI COMPONENT (TV STYLE)
=========================== */
interface KPIProps {
  title: string
  value: string
  count?: number
  trend?: number
  icon: React.ElementType
  invertTrend?: boolean
  color?: 'blue' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'sky' | 'violet' | 'gray'
  isMain?: boolean
}

const KPI = ({
  title,
  value,
  count,
  trend,
  icon: Icon,
  invertTrend = false,
  color = 'blue',
  isMain = false
}: KPIProps) => {
  const getTrendColor = (t: number) => {
    if (t === 0) return 'text-[var(--text-muted)]'
    const positive = t > 0
    if (invertTrend) return positive ? 'text-rose-400' : 'text-emerald-400'
    return positive ? 'text-emerald-400' : 'text-rose-400'
  }

  // Mapeamento de cores para classes Tailwind
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }

  return (
    <div className={`
      relative overflow-hidden rounded-2xl p-6 transition-all duration-300
      border backdrop-blur-md
      ${isMain ? 'bg-[var(--bg-panel)] shadow-lg shadow-amber-900/10 border-amber-500/30' : 'bg-[var(--bg-panel)] border-[var(--border)]'}
      hover:border-[var(--primary)]/30 group
    `}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorMap[color]} transition-colors`}>
          <Icon size={24} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[var(--bg-body)] ${getTrendColor(trend)}`}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '•'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--text-soft)] mb-1">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className={`font-bold tracking-tight text-[var(--text-main)] ${isMain ? 'text-3xl' : 'text-2xl'}`}>
            {value}
          </h3>
          {count !== undefined && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--bg-body)] text-[var(--text-soft)] border border-[var(--border)]">
              {count} un
            </span>
          )}
        </div>
      </div>
      
      {/* Decorative Glow */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none ${colorMap[color].split(' ')[0].replace('/10', '/30')}`} />
    </div>
  )
}

/* ===========================
   FUNNEL COMPONENT
=========================== */
const FUNNEL_PHASES = {
  LEADS: ['f045b8fe-ce70-466d-a323-3285bdb418e3', '6f68aa0d-6915-4aef-9542-811c9e8fce12'],
  QUALIFICADOS: ['3a1bf927-141e-4ffd-b3f5-8a02e018a128'],
  NEGOCIACAO: ['705b9fc4-ba5c-4837-91c6-d7b2f55dde2f', '0773b832-d4f7-4aa8-b962-23c8efd2b8a4', '6f84028d-2e5d-4ad3-9d46-20c19c9edf9e'],
  POS_VENDA: ['608e0e07-d5cc-4f9a-93a6-dcaaf9568963']
}
const STATUS_CONQUISTADO_ID = 'c8535d23-d002-4dbd-9bbe-9be97c2097ba'

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  LEADS: 'Leads',
  QUALIFICADOS: 'Leads Qualificados',
  NEGOCIACAO: 'Negociação',
  CONQUISTADO: 'Conquistado',
  POS_VENDA: 'Pós Venda',
}

const FUNNEL_STAGE_COLORS: Record<string, string> = {
  LEADS: '#1E3A8A',
  QUALIFICADOS: '#16A34A',
  NEGOCIACAO: '#EA580C',
  CONQUISTADO: '#F59E0B',
  POS_VENDA: '#7C3AED',
}

function getTemperaturaLabel(temperatura: number | null): { label: string; className: string } {
  if (temperatura == null) return { label: '—', className: 'text-[var(--text-muted)]' }
  if (temperatura <= 30) return { label: 'Fria', className: 'text-blue-400 bg-blue-400/10 border-blue-400/30' }
  if (temperatura <= 60) return { label: 'Morna', className: 'text-amber-400 bg-amber-400/10 border-amber-400/30' }
  if (temperatura <= 85) return { label: 'Quente', className: 'text-orange-400 bg-orange-400/10 border-orange-400/30' }
  return { label: 'Muito Quente', className: 'text-red-400 bg-red-400/10 border-red-400/30' }
}

function filterByStage(data: CRM_Oportunidade[], stageId: string): CRM_Oportunidade[] {
  return data.filter(item => {
    const faseId = item.id_fase
    const statusId = item.id_status
    if (stageId === 'LEADS') return faseId != null && FUNNEL_PHASES.LEADS.includes(faseId)
    if (stageId === 'QUALIFICADOS') return faseId != null && FUNNEL_PHASES.QUALIFICADOS.includes(faseId)
    if (stageId === 'NEGOCIACAO') return faseId != null && FUNNEL_PHASES.NEGOCIACAO.includes(faseId)
    if (stageId === 'CONQUISTADO') return statusId === STATUS_CONQUISTADO_ID
    if (stageId === 'POS_VENDA') return faseId != null && FUNNEL_PHASES.POS_VENDA.includes(faseId)
    return false
  })
}

type SortKey = 'data_inclusao' | 'cliente' | 'vendedor' | 'solucao' | 'temperatura' | 'prev_fechamento' | 'valor'
type SortDir = 'asc' | 'desc'

const FunnelPropostasModal = ({
  stageId,
  propostas,
  onClose,
  onRefresh,
}: {
  stageId: string | null
  propostas: CRM_Oportunidade[]
  onClose: () => void
  onRefresh: () => Promise<void>
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('data_inclusao')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try { await onRefresh() } finally { setIsRefreshing(false) }
  }

  const stageLabel = stageId ? (FUNNEL_STAGE_LABELS[stageId] ?? stageId) : ''
  const stageColor = stageId ? (FUNNEL_STAGE_COLORS[stageId] ?? '#888') : '#888'

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const getVal = (p: CRM_Oportunidade): string | number => {
      if (sortKey === 'data_inclusao') {
        const d = parseDate(p.data_inclusao)
        return d ? d.getTime() : 0
      }
      if (sortKey === 'cliente') return (p.cliente_nome ?? p.cliente ?? '').toLowerCase()
      if (sortKey === 'vendedor') return (p.vendedor_nome ?? p.vendedor ?? '').toLowerCase()
      if (sortKey === 'solucao') return (p.solucao ?? '').toLowerCase()
      if (sortKey === 'temperatura') return p.temperatura ?? -1
      if (sortKey === 'prev_fechamento') {
        const d = parseDate(p.prev_fechamento)
        return d ? d.getTime() : 0
      }
      if (sortKey === 'valor') return parseValorProposta(p.valor_proposta ?? (p.ticket_valor == null ? null : String(p.ticket_valor)))
      return ''
    }
    return [...propostas].sort((a, b) => {
      const av = getVal(a)
      const bv = getVal(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [propostas, sortKey, sortDir])

  const formatData = (d: string | null | undefined) => {
    if (!d) return '—'
    const parsed = parseDate(d)
    if (!parsed) return d
    return parsed.toLocaleDateString('pt-BR')
  }

  const formatSolucao = (s: string | null | undefined) => {
    if (s === 'PRODUTO') return 'Produto'
    if (s === 'SERVICO') return 'Serviço'
    return s ?? '—'
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-indigo-400" />
      : <ChevronDown size={12} className="text-indigo-400" />
  }

  const thClass = "py-3 px-3 text-[11px] uppercase font-semibold text-[var(--text-muted)] whitespace-nowrap select-none cursor-pointer hover:text-[var(--text-main)] transition-colors"

  return (
    <Modal
      isOpen={!!stageId}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-3 w-full">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: stageColor }}
          />
          <span>Propostas — {stageLabel}</span>
          <span className="text-sm font-normal text-[var(--text-muted)]">
            ({propostas.length} {propostas.length === 1 ? 'proposta' : 'propostas'})
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto mr-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-indigo-500/50 transition-colors disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      }
    >
      {propostas.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          Nenhuma proposta nesta fase.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-panel)] z-10">
              <tr className="border-b border-[var(--border)]">
                <th className={`${thClass} text-left`} onClick={() => handleSort('data_inclusao')}>
                  <span className="flex items-center gap-1">Data Inclusão <SortIcon col="data_inclusao" /></span>
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort('cliente')}>
                  <span className="flex items-center gap-1">Cliente <SortIcon col="cliente" /></span>
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort('vendedor')}>
                  <span className="flex items-center gap-1">Vendedor <SortIcon col="vendedor" /></span>
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort('solucao')}>
                  <span className="flex items-center gap-1">Solução <SortIcon col="solucao" /></span>
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort('temperatura')}>
                  <span className="flex items-center gap-1">Temperatura <SortIcon col="temperatura" /></span>
                </th>
                <th className={`${thClass} text-left`} onClick={() => handleSort('prev_fechamento')}>
                  <span className="flex items-center gap-1">Prev. Fechamento <SortIcon col="prev_fechamento" /></span>
                </th>
                <th className={`${thClass} text-right`} onClick={() => handleSort('valor')}>
                  <span className="flex items-center justify-end gap-1">Valor <SortIcon col="valor" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const temp = getTemperaturaLabel(p.temperatura)
                const valor = parseValorProposta(p.valor_proposta ?? (p.ticket_valor == null ? null : String(p.ticket_valor)))
                const vendedorNome = p.vendedor_nome ?? p.vendedor ?? '—'
                const avatarUrl = p.vendedor_avatar_url
                const initials = vendedorNome !== '—'
                  ? vendedorNome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                  : '?'
                return (
                  <tr
                    key={p.id_oport}
                    className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-body)] ${i % 2 !== 0 ? 'bg-[var(--bg-body)]/40' : ''}`}
                  >
                    <td className="py-3 px-3 text-[var(--text-main)] whitespace-nowrap">
                      {formatData(p.data_inclusao)}
                    </td>
                    <td className="py-3 px-3 text-[var(--text-main)] max-w-[180px] truncate">
                      {p.cliente_nome ?? p.cliente ?? '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={vendedorNome}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-[var(--border)]"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600">
                            {initials}
                          </div>
                        )}
                        <span className="text-[var(--text-main)] whitespace-nowrap">{vendedorNome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[var(--text-main)]">
                      {formatSolucao(p.solucao)}
                    </td>
                    <td className="py-3 px-3">
                      {p.temperatura != null ? (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${temp.className}`}>
                          {Math.round(p.temperatura)}° {temp.label}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--text-main)] whitespace-nowrap">
                      {formatData(p.prev_fechamento)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-[var(--text-main)] whitespace-nowrap">
                      {valor > 0 ? formatCurrency(valor) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

const FunnelSection = ({ data, onRefresh }: { data: CRM_Oportunidade[]; onRefresh: () => Promise<void> }) => {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const funnelData = useMemo(() => {
    const isCurrentMonth = (dateStr: string | null) => {
        if (!dateStr) return false
        const date = parseDate(dateStr)
        if (!date) return false
        const now = new Date()
        const spDate = new Date(now.toLocaleString('en-US', { timeZone: APP_TIME_ZONE }))
        const start = startOfMonth(spDate)
        const end = endOfMonth(spDate)
        return isWithinInterval(date, { start, end })
    }

    const acc = {
      LEADS: { count: 0, value: 0 },
      QUALIFICADOS: { count: 0, value: 0 },
      NEGOCIACAO: { count: 0, value: 0 },
      CONQUISTADO: { count: 0, value: 0 },
      POS_VENDA: { count: 0, value: 0 }
    }

    data.forEach(item => {
      const faseId = item.id_fase
      const statusId = item.id_status
      const valor = parseValorProposta(item.valor_proposta ?? (item.ticket_valor == null ? null : String(item.ticket_valor)))

      if (faseId && FUNNEL_PHASES.LEADS.includes(faseId)) {
        acc.LEADS.count += 1
      } else if (faseId && FUNNEL_PHASES.QUALIFICADOS.includes(faseId)) {
        acc.QUALIFICADOS.count += 1
      } else if (faseId && FUNNEL_PHASES.NEGOCIACAO.includes(faseId)) {
        acc.NEGOCIACAO.count += 1
        acc.NEGOCIACAO.value += valor
      } else if (statusId === STATUS_CONQUISTADO_ID) {
        if (isCurrentMonth(item.data_conquistado)) {
            acc.CONQUISTADO.count += 1
            acc.CONQUISTADO.value += valor
        }
      } else if (faseId && FUNNEL_PHASES.POS_VENDA.includes(faseId)) {
        acc.POS_VENDA.count += 1
      }
    })

    return [
      { id: 'LEADS', label: 'Leads', count: acc.LEADS.count, value: acc.LEADS.value, color: '#1E3A8A', hideValue: true },
      { id: 'QUALIFICADOS', label: 'Leads Qualificados', count: acc.QUALIFICADOS.count, value: acc.QUALIFICADOS.value, color: '#16A34A', hideValue: true },
      { id: 'NEGOCIACAO', label: 'Negociação', count: acc.NEGOCIACAO.count, value: acc.NEGOCIACAO.value, color: '#EA580C' },
      { id: 'CONQUISTADO', label: 'Conquistado', count: acc.CONQUISTADO.count, value: acc.CONQUISTADO.value, color: '#F59E0B' },
      { id: 'POS_VENDA', label: 'Pós Venda', count: acc.POS_VENDA.count, value: acc.POS_VENDA.value, color: '#7C3AED', hideValue: true }
    ]
  }, [data])

  const modalPropostas = useMemo(
    () => selectedStageId ? filterByStage(data, selectedStageId) : [],
    [data, selectedStageId]
  )

  return (
    <>
      <div className="card-panel p-6 h-full flex flex-col">
        <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-6 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400" />
          Funil de Vendas (Fases)
        </h3>

        <div className="flex-1 w-full min-h-[450px] flex items-center justify-center">
          <FunnelVendas data={funnelData} onStageClick={setSelectedStageId} />
        </div>
      </div>

      <FunnelPropostasModal
        stageId={selectedStageId}
        propostas={modalPropostas}
        onClose={() => setSelectedStageId(null)}
        onRefresh={onRefresh}
      />
    </>
  )
}

/* ===========================
   META MODAL COMPONENT
=========================== */
const MetaModal = ({ 
  isOpen, 
  onClose, 
  meta 
}: { 
  isOpen: boolean
  onClose: () => void
  meta: any 
}) => {
  const [formData, setFormData] = useState({
    meta_comercial: '',
    meta_geral: '',
    meta_valor_financeiro: 0,
    supermeta_valor_financeiro: 0,
    meta_novas_oportunidades: 0,
    meta_ligacoes: 0
  })

  const updateMutation = useUpdateMeta()

  useEffect(() => {
    if (meta) {
      // Fallback para meta_comercial caso a migração de renomeação não tenha sido aplicada ou cache
      const nomeMeta = meta.meta_geral || (meta as any).meta_comercial || ''
      
      setFormData({
        meta_comercial: meta.meta_comercial || '',
        meta_geral: nomeMeta,
        meta_valor_financeiro: meta.meta_valor_financeiro || 0,
        supermeta_valor_financeiro: meta.supermeta_valor_financeiro || 0,
        meta_novas_oportunidades: meta.meta_novas_oportunidades || 0,
        meta_ligacoes: meta.meta_ligacoes || 0
      })
    }
  }, [meta])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await updateMutation.mutateAsync({
        id: meta?.id, // Can be undefined, hook handles it
        updates: formData
      })
      onClose()
    } catch (error) {
      console.error('Erro ao salvar meta:', error)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--primary)]" />
            Configurar Metas
        </div>
      }
      size="md"
      footer={
          <>
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-body)] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={(e) => handleSubmit(e as any)}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors flex items-center gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Row 1: Financeiro & SuperMeta */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5">
                Meta Financeira (R$)
              </label>
              <input 
                type="number"
                step="0.01"
                value={formData.meta_valor_financeiro}
                onChange={e => setFormData({...formData, meta_valor_financeiro: Number(e.target.value)})}
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5 text-amber-400">
                SuperMeta (R$)
              </label>
              <input 
                type="number"
                step="0.01"
                value={formData.supermeta_valor_financeiro}
                onChange={e => setFormData({...formData, supermeta_valor_financeiro: Number(e.target.value)})}
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: Propostas Comerciais & Ligações */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5">
                Meta Novas Propostas Comerciais
              </label>
              <input 
                type="number"
                value={formData.meta_novas_oportunidades}
                onChange={e => setFormData({...formData, meta_novas_oportunidades: Number(e.target.value)})}
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5">
                Meta Ligações
              </label>
              <input 
                type="number"
                value={formData.meta_ligacoes}
                onChange={e => setFormData({...formData, meta_ligacoes: Number(e.target.value)})}
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 3: Nome da Meta */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5">
              Meta Geral
            </label>
            <input 
              type="text"
              value={formData.meta_geral}
              onChange={e => setFormData({...formData, meta_geral: e.target.value})}
              className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all"
              placeholder="Ex: Meta Q1 2026"
            />
          </div>

        </form>
    </Modal>
  )
}

/* ===========================
   PROGRESS BAR COMPONENT
=========================== */
const MetaProgressBar = ({ 
  current, 
  target, 
  label,
  onClick
}: { 
  current: number
  target: number 
  label: string
  onClick?: () => void
}) => {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl
        ${onClick ? 'cursor-pointer' : ''}
        bg-[var(--bg-panel)] border border-[var(--border)]
        hover:border-[var(--primary)]/50 transition-all duration-300
        group
      `}
    >
      {/* Background Gradient Mesh */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--primary)]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 gap-6">
        
        {/* Info Section */}
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-body)] border border-[var(--border)] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
             <div className="relative">
               <Target className="text-[var(--primary)]" size={24} />
               <div className="absolute inset-0 bg-[var(--primary)] blur-md opacity-20" />
             </div>
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-soft)] mb-0.5">
              {label}
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                {percent.toFixed(1)}<span className="text-lg text-[var(--text-muted)] font-bold">%</span>
              </span>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="flex-1 w-full md:max-w-xl">
          <div className="flex justify-end items-end mb-2.5 px-1">
             <span className="text-xl font-bold text-[var(--text-main)] tabular-nums">
               {formatCurrency(current)}
             </span>
          </div>

          <div className="h-4 w-full bg-[var(--bg-body)] rounded-full overflow-hidden border border-[var(--border)] p-[2px] shadow-inner">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out relative bg-gradient-to-r from-[var(--primary)] to-emerald-400"
              style={{ width: `${percent}%` }}
            >
              <div className="absolute inset-0 bg-white/25 animate-[shimmer_2s_infinite]" />
              {/* Glow at the tip */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}
