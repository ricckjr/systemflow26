import React, { useEffect, useMemo, useState } from 'react'
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
  Calendar,
  Filter
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
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears, isWithinInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseValorProposta, formatCurrency, parseDate } from '@/utils/comercial/format'
import { isVenda, isAtivo, CRM_Oportunidade } from '@/services/crm'
import { useOportunidades, usePabxLigacoes, useInvalidateCRM, useMeta, useUpdateMeta } from '@/hooks/useCRM'

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
  
  // Derived state
  const data = oportunidadesData || []
  const pabxLigacoes = pabxLigacoesData || []
  const loading = isLoadingOps || isLoadingPabx
  const lastUpdated = opsUpdatedAt ? new Date(opsUpdatedAt) : new Date()

  // Relógio em tempo real para o dashboard
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Filter State
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('month')
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /* ===========================
     STATS CALCULATION
  ============================ */
  const stats = useMemo(() => {
    // Determine current and previous date ranges
    let start, end, prevStart, prevEnd;
    
    if (filterType === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
      prevStart = startOfDay(subDays(selectedDate, 1));
      prevEnd = endOfDay(subDays(selectedDate, 1));
    } else if (filterType === 'month') {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
      prevStart = startOfMonth(subMonths(selectedDate, 1));
      prevEnd = endOfMonth(subMonths(selectedDate, 1));
    } else {
      start = startOfYear(selectedDate);
      end = endOfYear(selectedDate);
      prevStart = startOfYear(subYears(selectedDate, 1));
      prevEnd = endOfYear(subYears(selectedDate, 1));
    }

    // Helper to filter data by range
    const filterData = (list: CRM_Oportunidade[], s: Date, e: Date) => {
      return list.filter(d => {
        const raw = d.data || d.data_inclusao
        const dateObj = parseDate(raw)
        return dateObj && isWithinInterval(dateObj, { start: s, end: e })
      })
    }

    const currentData = filterData(data, start, end)
    const lastData = filterData(data, prevStart, prevEnd)
    const effective = currentData.length > 0 ? currentData : (filterType === 'month' && isWithinInterval(new Date(), { start, end }) ? [] : []) 
    // Note: original logic fell back to 'data' if currentData was empty, but with explicit filters usually we want 0 if empty.
    // However, keeping original behavior for 'effective' might confuse the specific filter. 
    // Let's strictly use currentData for values. If empty, values are 0.
    
    const calculateMetrics = (dataset: CRM_Oportunidade[]) => {
      const vendaValue = dataset.reduce((a, o) => a + (isVenda(o.status) ? parseValorProposta(o.valor_proposta) : 0), 0)
      const vendaCount = dataset.reduce((a, o) => a + (isVenda(o.status) ? 1 : 0), 0)
      
      const ativoItems = dataset.filter(o => isAtivo(o.status))
      const perdidoItems = dataset.filter(o => (o.status || '').toUpperCase() === 'PERDIDO')
      const canceladoItems = dataset.filter(o => (o.status || '').toUpperCase() === 'CANCELADO')

      return {
        vendaValue,
        vendaCount,
        ativoValue: ativoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        ativoCount: ativoItems.length,
        perdidoValue: perdidoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        perdidoCount: perdidoItems.length,
        canceladoValue: canceladoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        canceladoCount: canceladoItems.length
      }
    }

    const curr = calculateMetrics(currentData)
    const last = calculateMetrics(lastData)

    // Propostas (data_inclusao)
    const countProposals = (s: Date, e: Date) => data.filter(d => {
       const raw = d.data_inclusao
       const dateObj = parseDate(raw)
       return dateObj && isWithinInterval(dateObj, { start: s, end: e })
    }).length

    const propCurr = countProposals(start, end)
    const propLast = countProposals(prevStart, prevEnd)

    // Ligações (PABX)
    const countCalls = (s: Date, e: Date) => pabxLigacoes.reduce((acc, l) => {
       const d = parseDate(l.id_data)
       if (!d) return acc
       if (isWithinInterval(d, { start: s, end: e })) {
         return acc + l.ligacoes_feitas
       }
       return acc
    }, 0)

    const callsCurr = countCalls(start, end)
    const callsLast = countCalls(prevStart, prevEnd)

    const calcTrend = (currVal: number, lastVal: number) => {
      if (lastVal === 0) return currVal > 0 ? 100 : 0
      return ((currVal - lastVal) / lastVal) * 100
    }

    return {
      venda: { value: curr.vendaValue, count: curr.vendaCount, trend: calcTrend(curr.vendaValue, last.vendaValue) },
      ativo: { value: curr.ativoValue, count: curr.ativoCount, trend: calcTrend(curr.ativoValue, last.ativoValue) },
      perdido: { value: curr.perdidoValue, count: curr.perdidoCount, trend: calcTrend(curr.perdidoValue, last.perdidoValue) },
      cancelado: { value: curr.canceladoValue, count: curr.canceladoCount, trend: calcTrend(curr.canceladoValue, last.canceladoValue) },
      conversion: {
        value: currentData.length ? (curr.vendaCount / currentData.length) * 100 : 0,
        trend: calcTrend(
          currentData.length ? (curr.vendaCount / currentData.length) * 100 : 0,
          lastData.length ? (last.vendaCount / lastData.length) * 100 : 0
        )
      },
      avgTicket: {
        value: curr.vendaCount ? curr.vendaValue / curr.vendaCount : 0,
        trend: calcTrend(
          curr.vendaCount ? curr.vendaValue / curr.vendaCount : 0,
          last.vendaCount ? last.vendaValue / last.vendaCount : 0
        )
      },
      propostasGeradas: { value: propCurr, trend: calcTrend(propCurr, propLast) },
      ligacoesFeitas: { value: callsCurr, trend: calcTrend(callsCurr, callsLast) }
    }
  }, [data, pabxLigacoes, filterType, selectedDate])

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--primary)] animate-pulse">
        <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
        <p className="text-sm font-medium tracking-widest uppercase">Carregando Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER DASHBOARD TV */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight flex items-center gap-3">
            <span className="w-2 h-8 bg-[var(--primary)] rounded-full block"></span>
            Monitoramento Comercial
          </h1>
          <p className="text-sm text-[var(--text-soft)] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Atualizado em: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-3xl font-bold text-[var(--text-main)] leading-none font-mono">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-[var(--text-soft)] uppercase tracking-widest mt-1">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <button 
            onClick={() => setIsMetaModalOpen(true)}
            className="p-3 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all duration-300"
            title="Configurar Metas"
          >
            <Settings size={20} />
          </button>

          <button 
            onClick={() => invalidateCRM()}
            className="p-3 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all duration-300"
            title="Atualizar Dados"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4 bg-[var(--bg-panel)] p-2 rounded-xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-2 px-2 text-[var(--primary)]">
            <Filter size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Filtro</span>
          </div>
          
          <div className="h-6 w-px bg-[var(--border)]" />

          <div className="flex bg-[var(--bg-body)] rounded-lg p-1 border border-[var(--border)]">
            {(['day', 'month', 'year'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                  filterType === t 
                    ? 'bg-[var(--primary)] text-white shadow-sm' 
                    : 'text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]'
                }`}
              >
                {t === 'day' ? 'Dia' : t === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-[var(--border)]" />

          <div className="flex items-center gap-2 pr-2">
            <Calendar size={16} className="text-[var(--text-soft)]" />
            {filterType === 'day' && (
              <input 
                type="date" 
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => e.target.value && setSelectedDate(parseISO(e.target.value))}
                className="bg-transparent text-[var(--text-main)] text-sm font-medium focus:outline-none color-scheme-dark"
              />
            )}
            {filterType === 'month' && (
              <input 
                type="month" 
                value={format(selectedDate, 'yyyy-MM')}
                onChange={(e) => e.target.value && setSelectedDate(parseISO(e.target.value))}
                className="bg-transparent text-[var(--text-main)] text-sm font-medium focus:outline-none color-scheme-dark"
              />
            )}
            {filterType === 'year' && (
              <select
                value={selectedDate.getFullYear()}
                onChange={(e) => setSelectedDate(new Date(Number(e.target.value), 0, 1))}
                className="bg-transparent text-[var(--text-main)] text-sm font-medium focus:outline-none cursor-pointer [&>option]:text-black"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-[var(--bg-panel)] text-[var(--text-main)]">{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

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
        
        {/* Row 2 */}
        <KPI 
          title="Taxa de Conversão" 
          value={`${stats.conversion.value.toFixed(1)}%`} 
          trend={stats.conversion.trend}
          icon={Percent}
          color="violet"
        />
        <KPI 
          title="Ticket Médio" 
          value={formatCurrency(stats.avgTicket.value)} 
          trend={stats.avgTicket.trend}
          icon={ShoppingCart}
          color="emerald"
        />
        <KPI 
          title="Perdido" 
          value={formatCurrency(stats.perdido.value)} 
          count={stats.perdido.count}
          trend={stats.perdido.trend}
          icon={Ban} 
          invertTrend
          color="rose"
        />
        <KPI 
          title="Cancelado" 
          value={formatCurrency(stats.cancelado.value)} 
          count={stats.cancelado.count}
          trend={stats.cancelado.trend}
          icon={X} 
          invertTrend
          color="gray"
        />
      </div>

      {/* META PROGRESS BAR */}
      <div className="mb-6">
        <MetaProgressBar 
          current={stats.venda.value} 
          target={meta?.meta_valor_financeiro ? Number(meta.meta_valor_financeiro) : 0} 
          label="Super Meta"
          onClick={() => setIsMetaModalOpen(true)}
        />
      </div>

      {/* MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
        {/* FUNIL - Takes 7 cols */}
        <div className="xl:col-span-7 h-full">
          <FunnelSection data={data} />
        </div>

        {/* RANKING - Takes 5 cols */}
        <div className="xl:col-span-5 h-full">
          <RankingSection data={data} />
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
const FunnelSection = ({ data }: { data: CRM_Oportunidade[] }) => {
  const funnelData = useMemo(() => {
    const stages = [
      { id: 'PROSPECCAO', label: 'Prospecção', color: '#818cf8' },
      { id: 'QUALIFICACAO', label: 'Qualificação', color: '#60a5fa' },
      { id: 'APRESENTACAO', label: 'Apresentação', color: '#38bdf8' },
      { id: 'PROPOSTA', label: 'Proposta', color: '#2dd4bf' },
      { id: 'NEGOCIACAO', label: 'Negociação', color: '#fbbf24' }
    ]

    const grouped = data.reduce((acc, item) => {
      // Normalização robusta: usa etapa
      const raw = (item.etapa || '').toUpperCase()
      const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Ç/g, 'C').replace(/[^A-Z]/g, '')
      
      let stageId = ''
      // Mapeamento exato baseado no input do usuário
      if (normalized.includes('PROSPECCAO')) stageId = 'PROSPECCAO'
      else if (normalized.includes('QUALIFICACAO')) stageId = 'QUALIFICACAO'
      else if (normalized.includes('APRESENTACAO')) stageId = 'APRESENTACAO'
      else if (normalized.includes('PROPOSTA')) stageId = 'PROPOSTA'
      else if (normalized.includes('NEGOCIACAO')) stageId = 'NEGOCIACAO'

      if (stageId) {
        if (!acc[stageId]) acc[stageId] = { count: 0, value: 0 }
        acc[stageId].count += 1
        acc[stageId].value += parseValorProposta(item.valor_proposta)
      }
      return acc
    }, {} as Record<string, { count: number, value: number }>)

    return stages.map(stage => {
      const info = grouped[stage.id] || { count: 0, value: 0 }
      return {
        name: stage.label,
        value: info.count,
        totalValue: info.value,
        fill: stage.color
      }
    })
  }, [data])

  return (
    <div className="card-panel p-6 h-full flex flex-col">
      <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-6 uppercase tracking-wider flex items-center gap-2">
        <TrendingUp size={16} className="text-indigo-400" />
        Funil de Vendas (Etapas)
      </h3>
      
      <div className="flex-1 w-full min-h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={funnelData} margin={{ top: 0, right: 180, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={120}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fill="#ffffff" fontSize={14} fontWeight={700}>
                  {payload.value}
                </text>
              )}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                borderColor: 'rgba(255,255,255,0.1)', 
                borderRadius: '8px',
                color: '#f8fafc',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: any, name: any, props: any) => [
                <div key="tooltip" className="flex flex-col gap-1 py-1">
                  <span className="font-bold text-white text-lg">{value} ops</span>
                  <span className="text-sm text-gray-400">
                    Total: <span className="text-emerald-400 font-medium">{formatCurrency(props.payload.totalValue)}</span>
                  </span>
                </div>,
                name
              ]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={40}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList 
                dataKey="value" 
                position="right"
                content={(props: any) => {
                  const { x, y, height, value, index } = props
                  const item = funnelData[index]
                  if (!item) return null
                  return (
                    <text 
                      x={x + 12} 
                      y={y + height / 2} 
                      dy={6} 
                      fontSize={16} 
                      fontWeight={700} 
                      fill="#ffffff" 
                      className="animate-pulse"
                      style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}
                    >
                      {formatCurrency(item.totalValue)}
                      <tspan dx={12} fill="#ffffff" fontWeight={400} fontSize={14}>—</tspan>
                      <tspan dx={12} fill="#ffffff" fontWeight={700} fontSize={16}>{value}</tspan> <tspan fontSize={14} fill="#cbd5e1" fontWeight={500}>ops</tspan>
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ===========================
   RANKING COMPONENT
=========================== */
const RankingSection = ({ data }: { data: CRM_Oportunidade[] }) => {
  const ranking = useMemo(() => {
    const now = new Date()
    const currentM = String(now.getMonth() + 1).padStart(2, '0')
    const currentY = String(now.getFullYear())

    const vendasDoMes = data.filter(d => {
       const isSold = isVenda(d.status)
       const ym = getYearMonth(d)
       return isSold && (ym ? ym[0] === currentY && ym[1] === currentM : false)
    })

    const grouped = vendasDoMes.reduce((acc, item) => {
      const vendedor = item.vendedor || 'Não Identificado'
      const valor = parseValorProposta(item.valor_proposta)
      if (!acc[vendedor]) acc[vendedor] = 0
      acc[vendedor] += valor
      return acc
    }, {} as Record<string, number>)

    const sorted = Object.entries(grouped)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    const maxVal = sorted.length > 0 ? sorted[0].total : 0
    return { list: sorted, max: maxVal }
  }, [data])

  return (
    <div className="card-panel p-6 flex flex-col h-full">
      <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-6 uppercase tracking-wider flex items-center gap-2">
        <Award size={16} className="text-yellow-500" />
        Ranking de Vendedores (Mês Atual)
      </h3>

      {ranking.list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-soft)] min-h-[300px] border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-body)]/50">
           <div className="p-4 rounded-full bg-[var(--bg-body)] mb-3">
             <Award size={32} className="text-[var(--text-muted)]" />
           </div>
           <p className="text-sm font-medium">Sem vendas confirmadas</p>
           <p className="text-xs mt-1 opacity-60">Janeiro/2026</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar max-h-[400px]">
          {ranking.list.map((item, index) => {
            const isTop3 = index < 3
            const medalColor = index === 0 ? 'text-yellow-400 drop-shadow-md' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600'
            const percent = ranking.max > 0 ? (item.total / ranking.max) * 100 : 0
            
            return (
              <div key={item.name} className="relative group">
                <div className="flex items-center justify-between mb-2 z-10 relative">
                  <div className="flex items-center gap-3">
                    <span className={`font-black w-6 text-center ${medalColor} ${isTop3 ? 'text-lg' : 'text-sm'}`}>
                      {index + 1}º
                    </span>
                    <span className="text-sm font-bold text-[var(--text-main)] truncate max-w-[150px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {formatCurrency(item.total)}
                  </span>
                </div>
                
                <div className="h-2.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{ 
                      width: `${percent}%`,
                      backgroundColor: index === 0 ? '#fbbf24' : 'var(--primary)' 
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--primary)]" />
            Configurar Metas
          </h3>
          <button onClick={onClose} className="text-[var(--text-soft)] hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
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

          {/* Row 2: Oportunidades & Ligações */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-soft)] mb-1.5">
                Meta Novas Oportunidades
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

          <div className="pt-6 flex justify-end gap-3 border-t border-[var(--border)] mt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-body)] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors flex items-center gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
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
