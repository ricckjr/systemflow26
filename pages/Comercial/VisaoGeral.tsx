import React, { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Award, RefreshCw, X, Ban, Percent, ShoppingCart, Clock } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { logInfo, logError } from '../../utils/logger'
import { parseValorProposta, formatCurrency } from '../../utils/comercial/format'
import { fetchOportunidades } from '../../services/crm'

interface CRM_Oportunidade {
  id_oportunidade: string
  cod_oportunidade: string | null
  cliente: string | null
  vendedor: string | null
  solucao: string | null
  origem: string | null
  fase_kanban: string | null
  status: string | null
  valor_proposta: string | null
  data: string | null
  data_inclusao: string | null
}

const COLORS = ['#2a6ecb', '#2260a9', '#4a8be0', '#10b981', '#f59e0b']

// ================================
// Helpers de negócio
// ================================
const isVenda = (s?: string) =>
  ['CONQUISTADO', 'FATURADO', 'GANHO', 'VENDIDO'].includes((s || '').toUpperCase())

const isAtivo = (s?: string) =>
  !['CANCELADO', 'PERDIDO', 'FATURADO', 'CONQUISTADO', 'GANHO', 'VENDIDO'].includes((s || '').toUpperCase())

function parseDate(raw?: string | null) {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function getYearMonth(raw?: string | null) {
  const d = parseDate(raw)
  if (!d) return null
  return [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0')]
}

export default function VisaoGeral() {
  const [data, setData] = useState<CRM_Oportunidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ================================
  // Load
  // ================================
  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const items = await fetchOportunidades({ orderDesc: true })
        if (alive) {
          setData(items)
          logInfo('crm', 'registros', { count: items.length })
        }
      } catch (err: any) {
        logError('crm', 'load', err)
        if (alive) setError('Erro ao carregar dados do CRM')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  // ================================
  // Stats
  // ================================
  const stats = useMemo(() => {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const y = String(now.getFullYear())

    const byMonth = data.filter(d => {
      const ym = getYearMonth(d.data || d.data_inclusao)
      return ym ? ym[0] === y && ym[1] === m : false
    })

    // fallback: últimos 30 dias
    const limit = new Date()
    limit.setDate(limit.getDate() - 30)
    const last30 = data.filter(d => {
      const dt = parseDate(d.data || d.data_inclusao)
      return dt ? dt >= limit : false
    })

    const effective = byMonth.length ? byMonth : last30

    const vendaValue = effective.reduce((a, o) => a + (isVenda(o.status) ? parseValorProposta(o.valor_proposta) : 0), 0)
    const vendaCount = effective.reduce((a, o) => a + (isVenda(o.status) ? 1 : 0), 0)

    const ativo = effective.filter(o => isAtivo(o.status))
    const perdido = effective.filter(o => (o.status || '').toUpperCase() === 'PERDIDO')
    const cancelado = effective.filter(o => (o.status || '').toUpperCase() === 'CANCELADO')

    const funnel: Record<string, CRM_Oportunidade[]> = {}
    const origin: Record<string, number> = {}

    effective.forEach(o => {
      if (isAtivo(o.status)) {
        const f = o.fase_kanban || 'Lead'
        funnel[f] ||= []
        funnel[f].push(o)
      }
      const org = o.origem || 'Outro'
      origin[org] = (origin[org] || 0) + parseValorProposta(o.valor_proposta)
    })

    logInfo('crm', 'filtro', {
      recebidos: data.length,
      mes: byMonth.length,
      ult30: last30.length,
      vendas: vendaCount,
    })

    return {
      venda: { count: vendaCount, value: vendaValue },
      ativo: { count: ativo.length, value: ativo.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      perdido: { count: perdido.length, value: perdido.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      cancelado: { count: cancelado.length, value: cancelado.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      conversion: effective.length ? (vendaCount / effective.length) * 100 : 0,
      avgTicket: vendaCount ? vendaValue / vendaCount : 0,
      funnelData: Object.entries(funnel).map(([name, ops]) => ({ name, ops, count: ops.length })),
      originData: Object.entries(origin).map(([name, value]) => ({ name, value })),
    }
  }, [data])

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-400">
        <RefreshCw className="animate-spin" />
      </div>
    )

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-b from-[#0b1e2d] to-[#081522] p-8 space-y-10">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI title="Venda" value={formatCurrency(stats.venda.value)} icon={Award} />
        <KPI title="Ativo" value={formatCurrency(stats.ativo.value)} icon={TrendingUp} />
        <KPI title="Perdido" value={formatCurrency(stats.perdido.value)} icon={Ban} />
        <KPI title="Cancelado" value={formatCurrency(stats.cancelado.value)} icon={X} />
        <KPI title="Conversão" value={stats.conversion.toFixed(1) + '%'} icon={Percent} />
        <KPI title="Ticket Médio" value={formatCurrency(stats.avgTicket)} icon={ShoppingCart} />
      </div>

      <div className="bg-[#0f2538]/80 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
        <h3 className="text-white font-black mb-6">Funil</h3>
        {stats.funnelData.map((f, i) => (
          <div
            key={f.name}
            className="w-full mb-3 rounded-xl p-4 text-white flex items-center justify-between"
            style={{
              background: `linear-gradient(180deg, ${COLORS[i % COLORS.length]}, #081522)`,
              boxShadow: '0 0 25px rgba(42,110,203,.5)',
            }}
          >
            <span className="font-bold">{f.name}</span>
            <div className="flex items-center gap-4">
              <span className="text-sm bg-white/10 px-2 py-1 rounded-md border border-white/20">{f.count}</span>
              <span className="font-black">
                {formatCurrency(f.ops.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================================
// KPI
// ================================
const KPI = ({ title, value, icon: Icon }: any) => (
  <div className="bg-[#0f2538]/70 border border-white/10 backdrop-blur-xl rounded-2xl p-6 flex gap-5 items-center shadow-[0_0_30px_rgba(42,110,203,.2)]">
    <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
      <Icon />
    </div>
    <div>
      <p className="text-sm text-blue-300 font-bold">{title}</p>
      <p className="text-2xl md:text-3xl font-black text-white break-words">{value}</p>
    </div>
  </div>
)
