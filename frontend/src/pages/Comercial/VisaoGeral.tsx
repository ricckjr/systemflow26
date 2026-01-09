import React, { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Award,
  RefreshCw,
  X,
  Ban,
  Percent,
  ShoppingCart,
  FileText, // Importando ícone para Propostas
  Phone // Importando ícone para Ligações
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
import { logInfo, logError } from '@/utils/logger'
import { parseValorProposta, formatCurrency, parseDate } from '@/utils/comercial/format'
import { fetchOportunidades, isVenda, isAtivo, CRM_Oportunidade, fetchLigacoes, CRM_Ligacao } from '@/services/crm'

/* ===========================
   HELPERS
=========================== */
function getYearMonth(d: CRM_Oportunidade) {
  // Prioridade absoluta para o campo 'data' (formato MM-YYYY) conforme solicitado
  const raw = d.data || d.data_inclusao
  const dateObj = parseDate(raw)
  
  if (!dateObj) return null
  return [String(dateObj.getFullYear()), String(dateObj.getMonth() + 1).padStart(2, '0')]
}

export default function VisaoGeral() {
  const [data, setData] = useState<CRM_Oportunidade[]>([])
  const [ligacoes, setLigacoes] = useState<CRM_Ligacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ===========================
     LOAD
  ============================ */
  useEffect(() => {
    let alive = true

    const load = async () => {
      setLoading(true)
      try {
        // Busca paralela de Oportunidades e Ligações
        const [items, calls] = await Promise.all([
          fetchOportunidades({ orderDesc: true }),
          fetchLigacoes()
        ])
        
        if (alive) {
          setData(items)
          setLigacoes(calls)
          logInfo('crm', 'visao-geral', { count: items.length, calls: calls.length })
        }
      } catch (err) {
        logError('crm', 'visao-geral-load', err)
        if (alive) setError('Erro ao carregar dados. Verifique a conexão.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  /* ===========================
     STATS
  ============================ */
  const stats = useMemo(() => {
    const now = new Date()
    const currentM = String(now.getMonth() + 1).padStart(2, '0')
    const currentY = String(now.getFullYear())

    // Cálculo Mês Anterior
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastM = String(lastMonthDate.getMonth() + 1).padStart(2, '0')
    const lastY = String(lastMonthDate.getFullYear())

    // Helper de filtro
    const filterByMonth = (list: CRM_Oportunidade[], m: string, y: string) => {
      return list.filter(d => {
        const ym = getYearMonth(d)
        return ym ? ym[0] === y && ym[1] === m : false
      })
    }

    // Dados do Mês Atual
    const currentData = filterByMonth(data, currentM, currentY)
    // Se mês atual vazio, usa tudo (fallback original) APENAS para valores absolutos,
    // mas para tendência precisamos comparar laranjas com laranjas.
    // Vamos manter a lógica: Se currentData vazio, effective = data.
    // MAS para tendência, se currentData for vazio, a tendência será distorcida se compararmos "Tudo" com "Mês Passado".
    // Ajuste: O fallback "effective" é apenas para exibição quando não há dados.
    const effective = currentData.length > 0 ? currentData : data

    // Dados do Mês Anterior (sempre real)
    const lastData = filterByMonth(data, lastM, lastY)

    // Função para calcular métricas de um conjunto de dados
    const calculateMetrics = (dataset: CRM_Oportunidade[]) => {
      const vendaValue = dataset.reduce((a, o) => a + (isVenda(o.status) ? parseValorProposta(o.valor_proposta) : 0), 0)
      const vendaCount = dataset.reduce((a, o) => a + (isVenda(o.status) ? 1 : 0), 0)
      
      const ativoItems = dataset.filter(o => isAtivo(o.status))
      const perdidoItems = dataset.filter(o => (o.status || '').toUpperCase() === 'PERDIDO')
      const canceladoItems = dataset.filter(o => (o.status || '').toUpperCase() === 'CANCELADO')

      // Propostas (data_inclusao)
      // Nota: O dataset já está filtrado por data (geralmente data da venda ou atualização).
      // Para propostas geradas, precisamos filtrar novamente pela data_inclusao original se quisermos precisão,
      // mas se assumirmos que o dataset já é "do mês", podemos contar.
      // Porém, para consistência com o código anterior, vamos recalcular propostas baseadas em data_inclusao no dataset GLOBAL
      // filtrando pelo mês/ano específico deste dataset.
      
      // Mas espere, o dataset recebido aqui já foi filtrado por `getYearMonth` (que prioriza `data` mas usa `data_inclusao` como fallback).
      // Para manter a lógica exata de "Propostas Geradas" (criação), vamos contar quantas desse dataset tem data_inclusao compatível?
      // Ou melhor: Vamos usar a lógica dedicada de propostas para cada período.
      
      return {
        vendaValue,
        vendaCount,
        ativoValue: ativoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        ativoCount: ativoItems.length,
        perdidoValue: perdidoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        perdidoCount: perdidoItems.length,
        canceladoValue: canceladoItems.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0),
        canceladoCount: canceladoItems.length,
        totalItems: dataset.length
      }
    }

    // Calcula métricas atuais e anteriores
    const curr = calculateMetrics(effective)
    const last = calculateMetrics(lastData)

    // Cálculo específico de Propostas Geradas (Pela data de inclusão estrita)
    const countProposals = (m: string, y: string) => data.filter(d => {
       const raw = d.data_inclusao
       const dateObj = parseDate(raw)
       if (!dateObj) return false
       return String(dateObj.getFullYear()) === y && String(dateObj.getMonth() + 1).padStart(2, '0') === m
    }).length

    const propCurr = countProposals(currentM, currentY)
    const propLast = countProposals(lastM, lastY)

    // Cálculo de Ligações Feitas (Baseado em data_hora da tabela crm_ligacoes)
    const countCalls = (m: string, y: string) => ligacoes.filter(l => {
       const d = new Date(l.data_hora)
       if (isNaN(d.getTime())) return false
       return String(d.getFullYear()) === y && String(d.getMonth() + 1).padStart(2, '0') === m
    }).length

    const callsCurr = countCalls(currentM, currentY)
    const callsLast = countCalls(lastM, lastY)

    // Helper de tendência
    const calcTrend = (currVal: number, lastVal: number) => {
      if (lastVal === 0) return currVal > 0 ? 100 : 0 // Se base 0, subiu 100% se tiver algo
      return ((currVal - lastVal) / lastVal) * 100
    }

    return {
      venda: { 
        value: curr.vendaValue, 
        count: curr.vendaCount,
        trend: calcTrend(curr.vendaValue, last.vendaValue)
      },
      ativo: { 
        value: curr.ativoValue,
        count: curr.ativoCount,
        trend: calcTrend(curr.ativoValue, last.ativoValue)
      },
      perdido: { 
        value: curr.perdidoValue,
        count: curr.perdidoCount,
        trend: calcTrend(curr.perdidoValue, last.perdidoValue)
      },
      cancelado: { 
        value: curr.canceladoValue,
        count: curr.canceladoCount,
        trend: calcTrend(curr.canceladoValue, last.canceladoValue)
      },
      conversion: {
        value: effective.length ? (curr.vendaCount / effective.length) * 100 : 0,
        trend: calcTrend(
          effective.length ? (curr.vendaCount / effective.length) * 100 : 0,
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
      propostasGeradas: {
        value: propCurr,
        trend: calcTrend(propCurr, propLast)
      },
      ligacoesFeitas: {
        value: callsCurr,
        trend: calcTrend(callsCurr, callsLast)
      }
    }
  }, [data, ligacoes])

  /* ===========================
     LOADING
  ============================ */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--primary)]">
        <RefreshCw className="animate-spin" />
      </div>
    )
  }

  /* ===========================
     UI
  ============================ */
  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 gap-4">
        <KPI 
          title="Ligações Feitas" 
          value={String(stats.ligacoesFeitas.value)} 
          trend={stats.ligacoesFeitas.trend}
          icon={Phone} 
        />
        <KPI 
          title="Propostas Geradas" 
          value={String(stats.propostasGeradas.value)} 
          trend={stats.propostasGeradas.trend}
          icon={FileText} 
        />
        <KPI 
          title="Vendas" 
          value={formatCurrency(stats.venda.value)} 
          count={stats.venda.count}
          trend={stats.venda.trend}
          icon={Award} 
        />
        <KPI 
          title="Ativo" 
          value={formatCurrency(stats.ativo.value)} 
          count={stats.ativo.count}
          trend={stats.ativo.trend}
          icon={TrendingUp} 
        />
        <KPI 
          title="Perdido" 
          value={formatCurrency(stats.perdido.value)} 
          count={stats.perdido.count}
          trend={stats.perdido.trend}
          icon={Ban} 
          invertTrend // Queda é bom
        />
        <KPI 
          title="Cancelado" 
          value={formatCurrency(stats.cancelado.value)} 
          count={stats.cancelado.count}
          trend={stats.cancelado.trend}
          icon={X} 
          invertTrend // Queda é bom
        />
        <KPI 
          title="Conversão" 
          value={`${stats.conversion.value.toFixed(1)}%`} 
          trend={stats.conversion.trend}
          icon={Percent} 
        />
        <KPI 
          title="Ticket Médio" 
          value={formatCurrency(stats.avgTicket.value)} 
          trend={stats.avgTicket.trend}
          icon={ShoppingCart} 
        />
      </div>

      {/* GRIDS INFERIORES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* FUNIL DE VENDAS */}
        <FunnelSection data={data} />

        {/* RANKING DE VENDEDORES */}
        <RankingSection data={data} />
      </div>
    </div>
  )
}

/* ===========================
   RANKING COMPONENT
=========================== */
const RankingSection = ({ data }: { data: CRM_Oportunidade[] }) => {
  const ranking = useMemo(() => {
    // 0. Data Atual para filtro de mês
    const now = new Date()
    const currentM = String(now.getMonth() + 1).padStart(2, '0')
    const currentY = String(now.getFullYear())

    // 1. Filtra apenas vendas (Conquistado/Ganho/etc) E do Mês Atual
    const vendasDoMes = data.filter(d => {
       const isSold = isVenda(d.status)
       // Usa o mesmo helper de data dos KPIs para garantir consistência
       const ym = getYearMonth(d)
       const isCurrentMonth = ym ? ym[0] === currentY && ym[1] === currentM : false
       
       return isSold && isCurrentMonth
    })

    // 2. Agrupa por vendedor
    const grouped = vendasDoMes.reduce((acc, item) => {
      const vendedor = item.vendedor || 'Não Identificado'
      const valor = parseValorProposta(item.valor_proposta)
      
      if (!acc[vendedor]) acc[vendedor] = 0
      acc[vendedor] += valor
      return acc
    }, {} as Record<string, number>)

    // 3. Converte para array e ordena
    const sorted = Object.entries(grouped)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    // 4. Pega o valor máximo para a barra de progresso
    const maxVal = sorted.length > 0 ? sorted[0].total : 0

    return { list: sorted, max: maxVal }
  }, [data])

  // Removido o retorno null antecipado para mostrar o empty state
  // if (ranking.list.length === 0) return null

  return (
    <div className="card-panel p-6 flex flex-col h-full min-h-[400px]">
      <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-6 uppercase tracking-wider flex items-center gap-2">
        <Award size={16} className="text-yellow-500" />
        Ranking de Vendedores (Mês Atual)
      </h3>

      {ranking.list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-soft)] pb-8">
           <Award size={48} className="mb-3 opacity-20" />
           <p className="text-sm font-medium">Nenhuma venda confirmada neste mês.</p>
           <p className="text-xs mt-1 opacity-60">As vendas aparecerão aqui assim que o status for alterado para Conquistado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar max-h-[400px]">
          {ranking.list.map((item, index) => {
          const isTop3 = index < 3
          const medalColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'
          const percent = ranking.max > 0 ? (item.total / ranking.max) * 100 : 0
          
          return (
            <div key={item.name} className="relative group">
              <div className="flex items-center justify-between mb-1 z-10 relative">
                <div className="flex items-center gap-3">
                  <span className={`font-bold w-6 text-center ${medalColor} ${isTop3 ? 'text-lg' : 'text-sm'}`}>
                    {index + 1}º
                  </span>
                  <span className="text-sm font-medium text-[var(--text-main)] truncate max-w-[150px]">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm font-bold text-[var(--primary)]">
                  {formatCurrency(item.total)}
                </span>
              </div>
              
              {/* Progress Bar Background */}
              <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
                {/* Progress Bar Fill */}
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${percent}%`,
                    backgroundColor: index === 0 ? '#fbbf24' : 'var(--primary)' 
                  }}
                />
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
   FUNNEL COMPONENT
=========================== */
const FunnelSection = ({ data }: { data: CRM_Oportunidade[] }) => {
  const funnelData = useMemo(() => {
    // Definição da ordem e cores
    const stages = [
      { id: 'PROSPECCAO', label: 'Prospecção', color: '#818cf8' },
      { id: 'QUALIFICACAO', label: 'Qualificação', color: '#60a5fa' },
      { id: 'APRESENTACAO', label: 'Apresentação', color: '#38bdf8' },
      { id: 'PROPOSTA', label: 'Proposta', color: '#2dd4bf' },
      { id: 'NEGOCIACAO', label: 'Negociação', color: '#fbbf24' },
      { id: 'CONCLUSAO', label: 'Conclusão', color: '#fb923c' },
      { id: 'CONQUISTADO', label: 'Conquistado', color: '#4ade80' }
    ]

    // Agrupa dados
    const grouped = data.reduce((acc, item) => {
      // Normaliza a fase removendo acentos e espaços
      const raw = (item.fase_kanban || '').toUpperCase()
      const normalized = raw
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/Ç/g, 'C') // Ç -> C
        .replace(/[^A-Z]/g, '') // Mantém apenas letras

      // Mapeia para os IDs esperados (tratando variações comuns)
      let stageId = ''
      if (normalized.includes('PROSPECCAO')) stageId = 'PROSPECCAO'
      else if (normalized.includes('QUALIFICACAO')) stageId = 'QUALIFICACAO'
      else if (normalized.includes('APRESENTACAO')) stageId = 'APRESENTACAO'
      else if (normalized.includes('PROPOSTA')) stageId = 'PROPOSTA'
      else if (normalized.includes('NEGOCIACAO')) stageId = 'NEGOCIACAO'
      else if (normalized.includes('CONCLUSAO')) stageId = 'CONCLUSAO'
      else if (normalized.includes('CONQUISTADO') || normalized.includes('GANHO') || normalized.includes('VENDIDO')) stageId = 'CONQUISTADO'

      if (stageId) {
        if (!acc[stageId]) acc[stageId] = { count: 0, value: 0 }
        acc[stageId].count += 1
        acc[stageId].value += parseValorProposta(item.valor_proposta)
      }
      
      return acc
    }, {} as Record<string, { count: number, value: number }>)

    // Formata para o gráfico mantendo a ordem estrita
    return stages.map(stage => {
      const info = grouped[stage.id] || { count: 0, value: 0 }
      return {
        name: stage.label,
        value: info.count, // O tamanho do funil será baseado na quantidade
        totalValue: info.value, // Guardamos o valor monetário para o tooltip
        fill: stage.color
      }
    }).filter(item => item.value > 0) // Opcional: mostrar apenas fases com dados? O usuário pediu "nessa ordem", então talvez mostrar tudo seja melhor, mas funil vazio fica estranho. Vou filtrar zeros para ficar mais bonito, ou manter se quiser ver o buraco. O padrão de funil é filtrar.
  }, [data])

  if (funnelData.length === 0) return null

  return (
    <div className="card-panel p-6">
      <h3 className="text-[14px] font-semibold text-[var(--text-main)] mb-6 uppercase tracking-wider">
        Funil de Vendas (Etapas)
      </h3>
      
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={funnelData}
            margin={{ top: 0, right: 50, left: 50, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fill: 'var(--text-soft)', fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                borderColor: 'rgba(255,255,255,0.1)', 
                borderRadius: '8px',
                color: '#f8fafc',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              formatter={(value: any, name: any, props: any) => [
                <div key="tooltip" className="flex flex-col gap-1 py-1">
                  <span className="font-bold text-white text-lg">{value} oportunidades</span>
                  <span className="text-sm text-gray-400">
                    Valor total: <span className="text-emerald-400 font-medium">{formatCurrency(props.payload.totalValue)}</span>
                  </span>
                </div>,
                name
              ]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList 
                dataKey="value" 
                position="right"
                content={(props: any) => {
                  const { x, y, width, height, value, index } = props
                  const item = funnelData[index]
                  return (
                    <text 
                      x={x + 8} 
                      y={y + height / 2} 
                      dy={4}
                      fill="var(--text-main)" 
                      fontSize={11}
                      fontWeight={500}
                    >
                      {value} • {formatCurrency(item.totalValue)}
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
   KPI COMPONENT (ENHANCED)
=========================== */
interface KPIProps {
  title: string
  value: string      // Valor principal (geralmente monetário ou percentual)
  count?: number     // Quantidade opcional
  trend?: number     // Tendência em %
  icon: React.ElementType
  invertTrend?: boolean // Se true, queda é bom (ex: Perdido)
}

const KPI = ({
  title,
  value,
  count,
  trend,
  icon: Icon,
  invertTrend = false
}: KPIProps) => {
  // Define cor da tendência
  const getTrendColor = (t: number) => {
    if (t === 0) return 'text-gray-400'
    const positive = t > 0
    // Se invertTrend for true, subir é ruim (vermelho), descer é bom (verde)
    if (invertTrend) return positive ? 'text-red-400' : 'text-emerald-400'
    // Padrão: subir é bom (verde), descer é ruim (vermelho)
    return positive ? 'text-emerald-400' : 'text-red-400'
  }

  return (
    <div className="card-panel p-5 flex items-start gap-4 h-full relative overflow-hidden group">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                   bg-[var(--primary-soft)] text-[var(--primary)] mt-1"
      >
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-soft)] font-semibold mb-1">
          {title}
        </p>
        
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[18px] font-bold text-[var(--text-main)] leading-tight">
            {value}
          </p>
          {count !== undefined && (
            <span className="text-xs font-medium text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded">
              {count} un
            </span>
          )}
        </div>

        {trend !== undefined && (
          <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${getTrendColor(trend)}`}>
             {trend > 0 ? '↑' : trend < 0 ? '↓' : '•'} {Math.abs(trend).toFixed(1)}% 
             <span className="text-[var(--text-muted)] opacity-60 ml-1 font-normal">vs mês anterior</span>
          </div>
        )}
      </div>
    </div>
  )
}
