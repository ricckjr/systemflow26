import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'
import { checkSupabaseConnectivity, checkTableAccess } from '@/services/diagnostics'
import { logInfo } from '@/utils/logger'
import { fetchOportunidades, CRM_Oportunidade } from '@/services/crm'
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format'
import {
  Search,
  RefreshCw,
  X,
  ChevronDown
} from 'lucide-react'

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

  /* ===========================
     INIT
  ============================ */
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
      logInfo('crm', 'oportunidades carregadas', { count: items.length })
      setLista(items)
    } catch {
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

  /* ===========================
     FILTROS
  ============================ */
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
  }, [lista, debouncedSearch, vendedor, month, year])

  /* ===========================
     SAVE NOTA
  ============================ */
  const saveNota = async () => {
    if (!selected) return
    setSaving(true)

    await (supabase
      .from('crm_oportunidades') as any)
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

  /* ===========================
     UI
  ============================ */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-semibold tracking-wide text-[var(--text-main)]">
          Oportunidades
        </h1>

        <button
          onClick={fetchData}
          className="p-2.5 rounded-lg border border-[var(--border)]
                     hover:bg-white/5 transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10
                        px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* FILTERS */}
      <div className="card-panel p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou solução..."
            className="input-primary w-full pl-10"
          />
        </div>

        <Select value={month} onChange={setMonth} options={['all','01','02','03','04','05','06','07','08','09','10','11','12']} />
        <Select value={year} onChange={setYear} options={['all','2025','2026']} />
        <Select value={vendedor} onChange={setVendedor} options={['all', ...vendedores]} />
      </div>

      {/* TABLE */}
      <div className="card-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-[11px] uppercase text-[var(--text-muted)]">
            <tr>
              <th className="p-4 text-left font-medium">Cliente</th>
              <th className="p-4 text-left font-medium">Solução</th>
              <th className="p-4 text-right font-medium">Valor</th>
            </tr>
          </thead>

          <tbody>
            {filtrados.map(op => (
              <tr
                key={op.id_oportunidade}
                onClick={() => {
                  setSelected(op)
                  setNota(op.system_nota || '')
                }}
                className="cursor-pointer hover:bg-white/5 transition"
              >
                <td className="p-4 font-medium">{op.cliente}</td>
                <td className="p-4 text-[var(--text-soft)]">{op.solucao}</td>
                <td className="p-4 text-right font-semibold text-[var(--primary)]">
                  {formatCurrency(parseValorProposta(op.valor_proposta))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm
                        flex items-center justify-center">
          <div className="card-panel w-full max-w-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold">
                {selected.cliente}
              </h2>
              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-[var(--text-soft)]">
              <div><strong>Vendedor:</strong> {selected.vendedor}</div>
              <div><strong>Solução:</strong> {selected.solucao}</div>
              <div><strong>Valor:</strong> {formatCurrency(parseValorProposta(selected.valor_proposta))}</div>
              <div><strong>Etapa:</strong> {selected.fase_kanban}</div>
            </div>

            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              className="input-primary min-h-[120px]"
              placeholder="Notas estratégicas..."
            />

            <button
              onClick={saveNota}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? 'Salvando...' : 'Salvar estratégia'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===========================
   SELECT COMPONENT
=========================== */
const Select = ({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input-primary pr-8"
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-3 text-[var(--text-muted)] pointer-events-none" />
  </div>
)

export default Oportunidades
