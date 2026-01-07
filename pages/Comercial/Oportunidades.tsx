import React, { useEffect, useMemo, useState } from 'react'
import { supabase, SUPABASE_URL } from '../../supabaseClient'
import { pingSupabase } from '../../services/net'
import { logInfo, logError } from '../../utils/logger'
import { checkSupabaseConnectivity, checkTableAccess } from '../../services/diagnostics'
import {
  Search, CalendarDays, User, DollarSign, Hash, Briefcase, RefreshCw, X,
  CheckCircle2, Thermometer, Tag, MapPin, TrendingUp, Ban, PauseCircle,
  History, Sparkles, ChevronRight, FileText, Target, ChevronDown
} from 'lucide-react'
import { parseValorProposta, formatCurrency } from '../../utils/comercial/format'
import { fetchOportunidades } from '../../services/crm'

interface CRM_Oportunidade {
  id_oportunidade: string
  cod_oportunidade: string | null
  cliente: string | null
  nome_contato: string | null
  vendedor: string | null
  solucao: string | null
  origem: string | null
  fase_kanban: string | null
  status: string | null
  temperatura: number | null
  valor_proposta: string | null
  data: string | null
  data_inclusao: string | null
  dias_abertos: number | null
  observacoes_vendedor: string | null
  system_nota: string | null
  descricao_oportunidade: string | null
}

/* ===========================================
   CORE
=========================================== */

const Oportunidades: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState<CRM_Oportunidade[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendedor, setVendedor] = useState('all')
  const [month, setMonth] = useState('all')
  const [year, setYear] = useState('all')
  const [selected, setSelected] = useState<CRM_Oportunidade | null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      await checkSupabaseConnectivity()
      await checkTableAccess('crm_oportunidades')
      await fetchData()
    })()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await fetchOportunidades({ orderDesc: true })
      logInfo('crm', `oportunidades recebidas`, { count: items.length })
      setLista(items)
    } catch (e: any) {
      setError('Erro ao carregar oportunidades.')
      setLista([])
    } finally {
      setLoading(false)
    }
  }

  const vendedores = useMemo(
    () => Array.from(new Set(lista.map(l => l.vendedor).filter(Boolean))),
    [lista]
  )

  /* ===========================================
     FILTRO INTELIGENTE (MM-YYYY ou YYYY-MM)
  =========================================== */

  const filtrados = useMemo(() => {
    return lista.filter(op => {
      const s = debouncedSearch.toLowerCase()

      const matchSearch =
        (op.cliente || '').toLowerCase().includes(s) ||
        (op.solucao || '').toLowerCase().includes(s)

      const matchVendedor = vendedor === 'all' || op.vendedor === vendedor

      let matchDate = true
      if (month !== 'all' && year !== 'all' && op.data) {
        if (op.data.includes('-')) {
          const [a, b] = op.data.split('-')
          if (a.length === 4) matchDate = a === year && b === month.padStart(2, '0')
          else matchDate = a === month.padStart(2, '0') && b === year
        }
      }

      return matchSearch && matchVendedor && matchDate
    })
  }, [lista, search, vendedor, month, year])

  /* ===========================================
     KPIs
  =========================================== */

  const stats = useMemo(() => {
    const base = {
      ATIVO: { c: 0, v: 0 },
      CONQUISTADO: { c: 0, v: 0 },
      CANCELADO: { c: 0, v: 0 },
      SUSPENSO: { c: 0, v: 0 },
      PERDIDO: { c: 0, v: 0 },
    }

    filtrados.forEach(op => {
      const s = (op.status || 'ATIVO').toUpperCase()
      if (!base[s as keyof typeof base]) return
      base[s as keyof typeof base].c++
      base[s as keyof typeof base].v += parseValorProposta(op.valor_proposta)
    })

    return base
  }, [filtrados])

  /* ===========================================
     SAVE NOTA
  =========================================== */

  const saveNota = async () => {
    if (!selected) return
    setSaving(true)
    await supabase
      .from('crm_oportunidades')
      .update({ system_nota: nota })
      .eq('id_oportunidade', selected.id_oportunidade)

    setLista(l =>
      l.map(o =>
        o.id_oportunidade === selected.id_oportunidade
          ? { ...o, system_nota: nota }
          : o
      )
    )

    setSelected(prev => prev ? { ...prev, system_nota: nota } : prev)
    setSaving(false)
  }

  /* ===========================================
     UI
  =========================================== */

  return (
    <div className="min-h-screen bg-[#081522] p-8 space-y-8 text-white">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black uppercase tracking-tight">Oportunidades</h1>
        <button
          onClick={fetchData}
          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-brand-500/40"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-zinc-400" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou solução..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-brand-500"
          />
        </div>

        <Select value={month} onChange={setMonth} options={['all','01','02','03','04','05','06','07','08','09','10','11','12']} />
        <Select value={year} onChange={setYear} options={['all','2025','2026']} />
        <Select value={vendedor} onChange={setVendedor} options={['all', ...vendedores]} />
      </div>

      {/* TABLE */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400 text-xs">
            <tr>
              <th className="p-4 text-left">Cliente</th>
              <th className="p-4">Solução</th>
              <th className="p-4 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(op => (
              <tr
                key={op.id_oportunidade}
                onClick={() => { setSelected(op); setNota(op.system_nota || '') }}
                className="hover:bg-white/10 cursor-pointer"
              >
                <td className="p-4">{op.cliente}</td>
                <td className="p-4 text-zinc-400">{op.solucao}</td>
                <td className="p-4 text-right text-brand-400 font-bold">
                  {formatCurrency(parseValorProposta(op.valor_proposta))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50">
          <div className="bg-[#0d1f30] w-full max-w-4xl rounded-3xl border border-white/10 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black">{selected.cliente}</h2>
              <button onClick={() => setSelected(null)}><X /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Vendedor: {selected.vendedor}</div>
              <div>Solução: {selected.solucao}</div>
              <div>Valor: {formatCurrency(parseValorProposta(selected.valor_proposta))}</div>
              <div>Etapa: {selected.fase_kanban}</div>
            </div>

            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl p-4"
              placeholder="Notas estratégicas..."
            />

            <button
              onClick={saveNota}
              disabled={saving}
              className="w-full py-3 bg-brand-600 rounded-xl font-bold"
            >
              {saving ? 'Salvando...' : 'Salvar Estratégia'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

/* ===========================================
   COMPONENTS
=========================================== */

const Select = ({ value, onChange, options }: { value: string, onChange: (v: string) => void, options: string[] }) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm appearance-none pr-8"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <ChevronDown size={14} className="absolute right-2 top-3 text-zinc-400 pointer-events-none" />
  </div>
)

export default Oportunidades
