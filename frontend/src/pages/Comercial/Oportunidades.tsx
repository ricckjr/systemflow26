import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'
import { checkSupabaseConnectivity, checkTableAccess } from '@/services/diagnostics'
import { logInfo } from '@/utils/logger'
import { CRM_Oportunidade } from '@/services/crm'
import { parseValorProposta, formatCurrency, parseDate } from '@/utils/comercial/format'
import { useOportunidades, useInvalidateCRM } from '@/hooks/useCRM'
import {
  Search,
  RefreshCw,
  X,
  ChevronDown,
  Calendar,
  User,
  Briefcase,
  DollarSign,
  Tag,
  MessageSquare,
  Phone,
  Clock,
  Thermometer,
  FileText,
  Hash,
  Globe,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

const Oportunidades: React.FC = () => {
  // React Query Hooks
  const { 
    data: oportunidadesData, 
    isLoading: isLoadingOps, 
    error: errorOps,
    dataUpdatedAt 
  } = useOportunidades()
  
  const invalidateCRM = useInvalidateCRM()

  // Derived state
  const lista = oportunidadesData || []
  const loading = isLoadingOps
  const error = errorOps ? 'Erro ao carregar oportunidades.' : null
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendedor, setVendedor] = useState('all')
  const [month, setMonth] = useState('all')
  const [year, setYear] = useState('all')

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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
      // No need to fetch manually, React Query handles it
    })()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

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
      if (month !== 'all' && year !== 'all') {
         const raw = op.data || op.data_inclusao
         const d = parseDate(raw)
         if (d) {
            matchDate = String(d.getFullYear()) === year && String(d.getMonth() + 1).padStart(2, '0') === month
         } else {
            matchDate = false
         }
      } else if (year !== 'all') {
         const raw = op.data || op.data_inclusao
         const d = parseDate(raw)
         if (d) {
            matchDate = String(d.getFullYear()) === year
         } else {
            matchDate = false
         }
      }

      return matchSearch && matchVendedor && matchDate
    })
  }, [lista, debouncedSearch, vendedor, month, year])

  const sortedList = useMemo(() => {
    if (!sortColumn) return filtrados

    return [...filtrados].sort((a, b) => {
      let valA: any = a[sortColumn as keyof CRM_Oportunidade]
      let valB: any = b[sortColumn as keyof CRM_Oportunidade]

      // Handle numeric sorting for 'valor_proposta'
      if (sortColumn === 'valor_proposta') {
        valA = parseValorProposta(valA)
        valB = parseValorProposta(valB)
      } else {
        // Case insensitive string sorting
        valA = (valA || '').toString().toLowerCase()
        valB = (valB || '').toString().toLowerCase()
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filtrados, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  /* ===========================
     SAVE NOTA
  ============================ */
  const saveNota = async () => {
    if (!selected) return
    setSaving(true)

    try {
      await (supabase
        .from('crm_oportunidades') as any)
        .update({ system_nota: nota })
        .eq('id_oportunidade', selected.id_oportunidade)

      // Atualiza o cache globalmente após salvar
      invalidateCRM()
      
      // Atualiza o selecionado localmente para feedback imediato
      setSelected(prev => prev ? { ...prev, system_nota: nota } : prev)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  /* ===========================
     HELPERS UI
  ============================ */
  const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase()
    if (['CONQUISTADO', 'GANHO', 'VENDIDO', 'FATURADO'].includes(s)) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (['PERDIDO', 'CANCELADO'].includes(s)) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (['NEGOCIACAO', 'PROPOSTA'].includes(s)) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    if (['APRESENTACAO', 'QUALIFICACAO'].includes(s)) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }

  /* ===========================
     UI
  ============================ */
  return (
    <div className="space-y-8 animate-in fade-in duration-700 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight flex items-center gap-3">
            <span className="w-2 h-8 bg-indigo-500 rounded-full block"></span>
            Gestão de Oportunidades
          </h1>
          <p className="text-sm text-[var(--text-soft)] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            {sortedList.length} oportunidades encontradas • Atualizado em: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        <button
          onClick={() => invalidateCRM()}
          className="p-3 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all duration-300 self-start md:self-center"
          title="Atualizar Dados"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 shrink-0">
          {error}
        </div>
      )}

      {/* FILTERS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0">
        {/* Search */}
        <div className="md:col-span-5 relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, solução..."
            className="w-full pl-10 pr-4 py-3 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] outline-none transition-all shadow-sm"
          />
        </div>

        {/* Filter Group */}
        <div className="md:col-span-7 flex flex-wrap gap-3">
           <FilterSelect 
             icon={User} 
             value={vendedor} 
             onChange={setVendedor} 
             options={[{ value: 'all', label: 'Todos Vendedores' }, ...vendedores.map(v => ({ value: v, label: v || 'N/A' }))]} 
           />
           
           <FilterSelect 
             icon={Calendar} 
             value={month} 
             onChange={setMonth} 
             options={[
               { value: 'all', label: 'Todos os Meses' },
               { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
               { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
               { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
               { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
               { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
               { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
             ]} 
           />

           <FilterSelect 
             icon={Calendar} 
             value={year} 
             onChange={setYear} 
             options={[
               { value: 'all', label: 'Todos os Anos' },
               { value: '2025', label: '2025' },
               { value: '2026', label: '2026' }
             ]} 
           />
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 min-h-0 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col shadow-xl shadow-black/5">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-[var(--border)]">
              <tr>
                <SortableHeader label="Cliente / Oportunidade" column="cliente" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Responsável" column="vendedor" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Etapa / Status" column="etapa" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Valor Proposta" column="valor_proposta" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <th className="px-6 py-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {loading && lista.length === 0 ? (
                // Skeleton Loading
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-[var(--border)] rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[var(--border)] rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-[var(--border)] rounded-full w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[var(--border)] rounded w-1/3 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-[var(--border)] rounded w-8 mx-auto"></div></td>
                  </tr>
                ))
              ) : sortedList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-[var(--text-soft)]">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium">Nenhuma oportunidade encontrada</p>
                      <p className="text-sm opacity-60">Tente ajustar os filtros de busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedList.map(op => (
                  <tr
                    key={op.id_oportunidade}
                    onClick={() => {
                      setSelected(op)
                      setNota(op.system_nota || '')
                    }}
                    className="group hover:bg-[var(--primary)]/5 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors text-base">
                          {op.cliente}
                        </span>
                        <span className="text-xs text-[var(--text-soft)] flex items-center gap-1 mt-1">
                          <Tag size={12} />
                          {op.solucao || 'Sem solução definida'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {(op.vendedor || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[var(--text-main)]">{op.vendedor || 'N/A'}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {op.etapa && (
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(op.etapa)}`}>
                            {op.etapa}
                          </span>
                        )}
                        {/* Se o status for diferente da fase, mostra tbm */}
                        {op.status && op.status !== op.etapa && (
                          <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] px-1.5 rounded bg-[var(--bg-body)]">
                            {op.status}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                       <span className="font-bold text-[var(--text-main)] text-base font-mono">
                         {formatCurrency(parseValorProposta(op.valor_proposta))}
                       </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                       <button className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                         <MessageSquare size={16} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg-body)] text-xs text-[var(--text-soft)] flex justify-between items-center">
           <span>Mostrando {sortedList.length} de {lista.length} registros</span>
           <span>Pressione na linha para ver detalhes</span>
        </div>
      </div>

      {/* MODAL DETALHES */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelected(null)}
          />
          
          <div className="relative w-full max-w-2xl bg-[#1e293b] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-panel)]">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Briefcase className="text-indigo-400" size={20} />
                  {selected.cliente}
                </h2>
                <p className="text-xs text-[var(--text-soft)] mt-1">ID: {selected.id_oportunidade}</p>
              </div>
              <button 
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {/* 1. STATUS & VALOR (HIGHLIGHTS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-3 opacity-10">
                     <DollarSign size={48} />
                   </div>
                   <p className="text-xs uppercase text-[var(--text-muted)] font-semibold mb-1">Valor da Proposta</p>
                   <p className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
                     {formatCurrency(parseValorProposta(selected.valor_proposta))}
                   </p>
                </div>
                
                <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-3 opacity-10">
                     <Briefcase size={48} />
                   </div>
                   <p className="text-xs uppercase text-[var(--text-muted)] font-semibold mb-2">Status do Funil</p>
                   <div className="flex flex-wrap gap-2">
                     <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${getStatusColor(selected.etapa || '')}`}>
                        {selected.etapa || 'N/A'}
                     </span>
                     {selected.status && selected.status !== selected.etapa && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border)] text-[var(--text-muted)]">
                          {selected.status}
                        </span>
                     )}
                   </div>
                </div>
              </div>

              {/* 2. INFORMAÇÕES DETALHADAS */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                  <FileText size={14} className="text-indigo-400" />
                  Detalhes do Cliente & Negociação
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem icon={User} label="Vendedor Responsável" value={selected.vendedor} />
                  <DetailItem icon={Phone} label="Contato Principal" value={selected.nome_contato} />
                  <DetailItem icon={Tag} label="Solução Ofertada" value={selected.solucao} />
                  <DetailItem icon={Globe} label="Origem / Canal" value={selected.origem} />
                  <DetailItem icon={Thermometer} label="Temperatura" value={selected.temperatura ? `${selected.temperatura}%` : null} />
                  <DetailItem icon={Clock} label="Dias em Aberto" value={selected.dias_abertos ? `${selected.dias_abertos} dias` : null} />
                  <DetailItem icon={Hash} label="Cód. Oportunidade" value={selected.cod_oportunidade} />
                  <DetailItem icon={Calendar} label="Data Inclusão" value={parseDate(selected.data_inclusao)?.toLocaleDateString()} />
                  <DetailItem icon={Calendar} label="Data Atualização" value={parseDate(selected.data)?.toLocaleDateString()} />
                </div>
              </div>

              {/* 3. DESCRIÇÃO & OBSERVAÇÕES (READ ONLY) */}
              {(selected.descricao_oportunidade || selected.observacoes_vendedor) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selected.descricao_oportunidade && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-soft)] uppercase">Descrição Inicial</label>
                      <div className="p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border)] text-sm text-[var(--text-soft)] min-h-[80px]">
                        {selected.descricao_oportunidade}
                      </div>
                    </div>
                  )}
                  {selected.observacoes_vendedor && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-soft)] uppercase">Obs. do Vendedor</label>
                      <div className="p-3 rounded-lg bg-[var(--bg-body)] border border-[var(--border)] text-sm text-[var(--text-soft)] min-h-[80px]">
                        {selected.observacoes_vendedor}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. NOTAS ESTRATÉGICAS (EDITABLE) */}
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-400" />
                  Notas e Estratégia (Sistema)
                </label>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  className="w-full min-h-[120px] bg-[var(--bg-body)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none placeholder:text-[var(--text-muted)]/50 transition-all"
                  placeholder="Escreva aqui detalhes importantes sobre a negociação, próximos passos ou observações estratégicas..."
                />
                <p className="text-xs text-[var(--text-muted)] text-right">
                  Essas notas são salvas apenas no sistema e não sobrescrevem as observações do CRM original.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-panel)] flex justify-end">
              <button
                onClick={saveNota}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : null}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===========================
   FILTER COMPONENT
=========================== */
const FilterSelect = ({
  value,
  onChange,
  options,
  icon: Icon
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  icon: React.ElementType
}) => (
  <div className="relative min-w-[160px] flex-1">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
      <Icon size={16} />
    </div>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full pl-9 pr-8 py-3 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl text-sm appearance-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] outline-none transition-all cursor-pointer text-[var(--text-main)]"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#1e293b]">{o.label}</option>
      ))}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
  </div>
)

/* ===========================
   DETAIL ITEM COMPONENT
=========================== */
const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)]/50 bg-[var(--bg-body)]/50 hover:bg-[var(--bg-body)] transition-colors">
    <div className="p-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-muted)] shrink-0">
      <Icon size={14} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[var(--text-main)] truncate block" title={typeof value === 'string' ? value : undefined}>
        {value || <span className="text-[var(--text-muted)] italic">N/A</span>}
      </p>
    </div>
  </div>
)

/* ===========================
   SORTABLE HEADER COMPONENT
=========================== */
const SortableHeader = ({ 
  label, 
  column, 
  currentSort, 
  direction, 
  onSort, 
  align = 'left' 
}: {
  label: string
  column: string
  currentSort: string | null
  direction: 'asc' | 'desc'
  onSort: (col: string) => void
  align?: 'left' | 'center' | 'right'
}) => {
  const isActive = currentSort === column
  
  return (
    <th 
      className={`px-6 py-4 font-semibold cursor-pointer group hover:text-[var(--primary)] transition-colors select-none text-${align}`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        <span className="flex flex-col">
          {isActive ? (
            direction === 'asc' ? <ArrowUp size={14} className="text-[var(--primary)]" /> : <ArrowDown size={14} className="text-[var(--primary)]" />
          ) : (
            <div className="flex flex-col opacity-0 group-hover:opacity-30 transition-opacity">
               <ArrowUp size={10} className="-mb-1" />
               <ArrowDown size={10} />
            </div>
          )}
        </span>
      </div>
    </th>
  )
}

export default Oportunidades
