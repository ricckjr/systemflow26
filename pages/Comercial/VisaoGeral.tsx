import React, { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Award,
  RefreshCw,
  X,
  Ban,
  Percent,
  ShoppingCart
} from 'lucide-react'
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

/* ===========================
   HELPERS (INALTERADOS)
=========================== */
const isVenda = (s?: string) =>
  ['CONQUISTADO', 'FATURADO', 'GANHO', 'VENDIDO'].includes((s || '').toUpperCase())

const isAtivo = (s?: string) =>
  !['CANCELADO', 'PERDIDO', 'FATURADO', 'CONQUISTADO', 'GANHO', 'VENDIDO'].includes(
    (s || '').toUpperCase()
  )

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

  /* ===========================
     LOAD
  ============================ */
  useEffect(() => {
    let alive = true

    const load = async () => {
      setLoading(true)
      try {
        const items = await fetchOportunidades({ orderDesc: true })
        if (alive) {
          setData(items)
          logInfo('crm', 'visao-geral', { count: items.length })
        }
      } catch (err) {
        logError('crm', 'visao-geral-load', err)
        if (alive) setError('Erro ao carregar dados do CRM.')
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
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const y = String(now.getFullYear())

    const byMonth = data.filter(d => {
      const ym = getYearMonth(d.data || d.data_inclusao)
      return ym ? ym[0] === y && ym[1] === m : false
    })

    const limit = new Date()
    limit.setDate(limit.getDate() - 30)
    const last30 = data.filter(d => {
      const dt = parseDate(d.data || d.data_inclusao)
      return dt ? dt >= limit : false
    })

    const effective = byMonth.length ? byMonth : last30

    const vendaValue = effective.reduce(
      (a, o) => a + (isVenda(o.status) ? parseValorProposta(o.valor_proposta) : 0),
      0
    )
    const vendaCount = effective.reduce(
      (a, o) => a + (isVenda(o.status) ? 1 : 0),
      0
    )

    const ativo = effective.filter(o => isAtivo(o.status))
    const perdido = effective.filter(o => (o.status || '').toUpperCase() === 'PERDIDO')
    const cancelado = effective.filter(o => (o.status || '').toUpperCase() === 'CANCELADO')

    return {
      venda: { count: vendaCount, value: vendaValue },
      ativo: { value: ativo.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      perdido: { value: perdido.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      cancelado: { value: cancelado.reduce((a, b) => a + parseValorProposta(b.valor_proposta), 0) },
      conversion: effective.length ? (vendaCount / effective.length) * 100 : 0,
      avgTicket: vendaCount ? vendaValue / vendaCount : 0,
    }
  }, [data])

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPI title="Vendas" value={formatCurrency(stats.venda.value)} icon={Award} />
        <KPI title="Ativo" value={formatCurrency(stats.ativo.value)} icon={TrendingUp} />
        <KPI title="Perdido" value={formatCurrency(stats.perdido.value)} icon={Ban} />
        <KPI title="Cancelado" value={formatCurrency(stats.cancelado.value)} icon={X} />
        <KPI title="Conversão" value={`${stats.conversion.toFixed(1)}%`} icon={Percent} />
        <KPI title="Ticket Médio" value={formatCurrency(stats.avgTicket)} icon={ShoppingCart} />
      </div>
    </div>
  )
}

/* ===========================
   KPI COMPONENT (VISUAL ONLY)
=========================== */
const KPI = ({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon: React.ElementType
}) => (
  <div className="card-panel p-5 flex items-center gap-4">
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center
                 bg-[var(--primary-soft)] text-[var(--primary)]"
    >
      <Icon size={20} />
    </div>

    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-soft)] mb-1">
        {title}
      </p>
      <p className="text-[18px] font-semibold text-[var(--text-main)] truncate">
        {value}
      </p>
    </div>
  </div>
)
