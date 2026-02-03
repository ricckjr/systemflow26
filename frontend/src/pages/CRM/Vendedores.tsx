import React, { useEffect, useState, useMemo } from 'react';
import { 
  Trophy, 
  Star, 
  Target, 
  Users, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Award,
  ChevronRight,
  X,
  PieChart,
  BarChart2,
  Phone,
  PhoneMissed
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { CRM_Oportunidade, CRM_VendedorPerformance, isVenda } from '@/services/crm';
import { useOportunidades, usePabxLigacoes, useVendedoresPerformance } from '@/hooks/useCRM';
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format';
import { formatDateBR } from '@/utils/datetime';
import { Modal } from '@/components/ui';
import { format, isSameMonth, parseISO, parse, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuration
const META_INDIVIDUAL = 50000; // R$ 50.000,00

interface SellerStats {
  name: string;
  totalVendas: number;
  totalOportunidades: number;
  taxaConversao: number;
  ticketMedio: number;
  meta: number;
  pctMeta: number;
  ranking: number;
  vendasPorDia: { dia: string; valor: number }[];
  historico: CRM_Oportunidade[];
  ligacoesFeitas: number;
  ligacoesNaoAtendidas: number;
  trendVendas: number; // New field for MoM trend
  avatarUrl?: string | null;
  emailCorporativo?: string | null;
  telefone?: string | null;
  ramal?: string | null;
  performance?: CRM_VendedorPerformance | null;
}

const Vendedores: React.FC = () => {
  // React Query Hook
  const { data: oportunidadesData, isLoading: loadingOps } = useOportunidades();
  const { data: ligacoesData, isLoading: loadingLig } = usePabxLigacoes();
  
  const allOportunidades = oportunidadesData || [];
  const allLigacoes = ligacoesData || [];

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const currentMonthStr = useMemo(() => format(selectedMonth, 'MM-yyyy'), [selectedMonth]);
  const prevMonth = useMemo(() => subMonths(selectedMonth, 1), [selectedMonth]);

  const { data: vendedoresPerformanceData } = useVendedoresPerformance(currentMonthStr);
  const allVendedoresPerformance = vendedoresPerformanceData || [];

  const vendedoresPerformanceByName = useMemo(() => {
    const map = new Map<string, CRM_VendedorPerformance>();
    allVendedoresPerformance.forEach((p) => {
      const key = (p.vendedor || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, p);
    });
    return map;
  }, [allVendedoresPerformance]);
  // Process data when opportunities or month changes
  const sellers = useMemo(() => {
    // Format selectedMonth to "MM-yyyy" for PABX data matching
    const filteredOps = allOportunidades.filter(op => {
      if (!op.data_inclusao) return false;
      return isSameMonth(parseISO(op.data_inclusao), selectedMonth);
    });

    // Filter Previous Month (for trend calculation)
    const prevFilteredOps = allOportunidades.filter(op => {
      if (!op.data_inclusao) return false;
      return isSameMonth(parseISO(op.data_inclusao), prevMonth);
    });

    // Group by seller
    const sellerMap: Record<string, {
      totalVendas: number;
      prevTotalVendas: number; // Store previous month sales
      countVendas: number;
      totalOps: number;
      ops: CRM_Oportunidade[];
      ligacoesFeitas: number;
      ligacoesNaoAtendidas: number;
    }> = {};

    // 1. Process Current Month Opportunities
    filteredOps.forEach(op => {
      const sellerName = op.vendedor || 'Não Atribuído';
      if (!sellerMap[sellerName]) {
        sellerMap[sellerName] = { 
          totalVendas: 0, 
          prevTotalVendas: 0,
          countVendas: 0, 
          totalOps: 0, 
          ops: [],
          ligacoesFeitas: 0,
          ligacoesNaoAtendidas: 0
        };
      }

      sellerMap[sellerName].totalOps += 1;
      sellerMap[sellerName].ops.push(op);

      if (isVenda(op.status)) {
        const valor = parseValorProposta(op.valor_proposta ?? (op.ticket_valor == null ? null : String(op.ticket_valor)));
        sellerMap[sellerName].totalVendas += valor;
        sellerMap[sellerName].countVendas += 1;
      }
    });

    // 1.1 Process Previous Month Opportunities (for Trend)
    prevFilteredOps.forEach(op => {
      if (isVenda(op.status)) {
        const sellerName = op.vendedor || 'Não Atribuído';
        
        if (sellerMap[sellerName]) {
           const valor = parseValorProposta(op.valor_proposta ?? (op.ticket_valor == null ? null : String(op.ticket_valor)));
           sellerMap[sellerName].prevTotalVendas += valor;
        }
      }
    });

    // 2. Process Calls (PABX)
    allLigacoes.forEach(lig => {
      if (lig.id_data === currentMonthStr) {
        const sellerName = lig.vendedor || 'Não Atribuído';
        if (!sellerMap[sellerName]) {
          // Initialize if only has calls but no opportunities yet
          sellerMap[sellerName] = { 
            totalVendas: 0, 
            prevTotalVendas: 0,
            countVendas: 0, 
            totalOps: 0, 
            ops: [],
            ligacoesFeitas: 0,
            ligacoesNaoAtendidas: 0
          };
        }
        sellerMap[sellerName].ligacoesFeitas += lig.ligacoes_feitas;
        sellerMap[sellerName].ligacoesNaoAtendidas += lig.ligacoes_nao_atendidas;
      }
    });

    // 3. Ensure sellers from performance table appear even without ops/calls
    allVendedoresPerformance.forEach((p) => {
      const sellerName = p.vendedor || 'Não Atribuído';
      if (!sellerMap[sellerName]) {
        sellerMap[sellerName] = {
          totalVendas: 0,
          prevTotalVendas: 0,
          countVendas: 0,
          totalOps: 0,
          ops: [],
          ligacoesFeitas: 0,
          ligacoesNaoAtendidas: 0
        };
      }
    });

    // Transform to array
    const sellerArray: SellerStats[] = Object.entries(sellerMap).map(([name, data]) => {
      const parsePercent = (raw?: string | null) => {
        const s = (raw || '').toString().trim();
        if (!s) return 0;
        const n = parseFloat(s.replace('%', '').replace(',', '.'));
        if (!Number.isFinite(n)) return 0;
        const normalized = n <= 1 ? n * 100 : n;
        return Math.max(0, Math.min(100, normalized));
      };

      const perf = vendedoresPerformanceByName.get(name.trim().toLowerCase()) || null;
      const metaFromPerf = perf ? parseValorProposta(perf.meta_financeira_total_mes) : 0;
      const meta = metaFromPerf > 0 ? metaFromPerf : META_INDIVIDUAL;

      const totalVendas = perf ? parseValorProposta(perf.valor_vendido) : data.totalVendas;
      const totalOportunidades = perf ? perf.total_quantidade_oportunidades : data.totalOps;
      const ligacoesFeitas = perf ? perf.ligacoes_feitas : data.ligacoesFeitas;

      const taxaConversao = perf ? parsePercent(perf.taxa_conversao_real) : (data.totalOps > 0 ? (data.countVendas / data.totalOps) * 100 : 0);
      const ticketMedio = perf ? parseValorProposta(perf.ticket_medio) : (data.countVendas > 0 ? data.totalVendas / data.countVendas : 0);

      const pctMetaFromPerf = perf ? parsePercent(perf.progresso_meta_mensal || perf.percentual_meta_financeira) : 0;
      const pctMeta = pctMetaFromPerf > 0 ? pctMetaFromPerf : ((totalVendas / meta) * 100);

      // Calculate Trend
      let trendVendas = 0;
      if (data.prevTotalVendas > 0) {
        trendVendas = ((data.totalVendas - data.prevTotalVendas) / data.prevTotalVendas) * 100;
      } else if (data.totalVendas > 0) {
        trendVendas = 100; // New sales where previously 0
      }

      // Calculate sales over time
      const salesByDayMap: Record<string, number> = {};
      data.ops.filter(o => isVenda(o.status)).forEach(o => {
        const full = formatDateBR(o.data_inclusao);
        if (!full) return;
        const day = full.slice(0, 5);
        const val = parseValorProposta(o.valor_proposta ?? (o.ticket_valor == null ? null : String(o.ticket_valor)));
        salesByDayMap[day] = (salesByDayMap[day] || 0) + val;
      });
      const vendasPorDia = Object.entries(salesByDayMap).map(([dia, valor]) => ({ dia, valor })).sort((a, b) => a.dia.localeCompare(b.dia));

      return {
        name,
        totalVendas,
        totalOportunidades,
        taxaConversao,
        ticketMedio,
        meta,
        pctMeta,
        ranking: 0, // Will sort next
        vendasPorDia,
        historico: data.ops,
        ligacoesFeitas,
        ligacoesNaoAtendidas: data.ligacoesNaoAtendidas,
        trendVendas,
        avatarUrl: perf?.avatar_url ?? null,
        emailCorporativo: perf?.email_corporativo ?? null,
        telefone: perf?.telefone ?? null,
        ramal: perf?.ramal ?? null,
        performance: perf,
      };
    });

    // Sort by sales (Ranking)
    sellerArray.sort((a, b) => b.totalVendas - a.totalVendas);
    sellerArray.forEach((s, i) => s.ranking = i + 1);

    return sellerArray;

  }, [allOportunidades, allLigacoes, allVendedoresPerformance, vendedoresPerformanceByName, selectedMonth, currentMonthStr, prevMonth]);

  const [selectedSeller, setSelectedSeller] = useState<SellerStats | null>(null);

  const handlePrevMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  if ((loadingOps || loadingLig) && allOportunidades.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-cyan-500 gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Award size={20} />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-main)]">Performance Comercial</h2>
          </div>
          <p className="text-xs text-[var(--text-soft)] ml-14">Ranking e indicadores de desempenho individual</p>
        </div>

        <div className="flex items-center gap-4 bg-[var(--bg-panel)] border border-[var(--border)] p-1.5 rounded-xl shadow-sm">
          <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <ChevronRight size={16} className="rotate-180" />
          </button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
            <Calendar size={14} className="text-cyan-400" />
            <span className="text-sm font-bold text-[var(--text-main)] capitalize">
              {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
          <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* SELLERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sellers.map((seller) => (
          <div 
            key={seller.name}
            onClick={() => setSelectedSeller(seller)}
            className="group relative bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-6 cursor-pointer hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 overflow-hidden"
          >
            {/* Rank Badge */}
            <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl font-black text-xs shadow-sm
              ${seller.ranking === 1 ? 'bg-gradient-to-bl from-yellow-400 to-amber-500 text-white shadow-amber-500/20' : 
                seller.ranking === 2 ? 'bg-gradient-to-bl from-slate-300 to-slate-400 text-white shadow-slate-500/20' :
                seller.ranking === 3 ? 'bg-gradient-to-bl from-orange-400 to-orange-500 text-white shadow-orange-500/20' :
                'bg-[var(--bg-body)] text-[var(--text-muted)] border-l border-b border-[var(--border)]'}
            `}>
              #{seller.ranking}
            </div>

            {/* Avatar & Name */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-3">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold uppercase border-4 shadow-xl bg-center bg-cover
                    ${seller.ranking === 1 ? 'border-amber-400 text-amber-500 bg-amber-500/10' : 'border-[var(--bg-body)] text-[var(--primary)] bg-[var(--primary)]/10'}
                  `}
                  style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}
                >
                  {!seller.avatarUrl ? seller.name.substring(0, 2) : null}
                </div>
                {seller.ranking === 1 && (
                  <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-1.5 rounded-full shadow-lg animate-bounce">
                    <Trophy size={14} fill="currentColor" />
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)] truncate w-full">{seller.name}</h3>
              <p className="text-xs text-[var(--text-soft)] uppercase tracking-widest font-semibold mt-1">Executivo de Vendas</p>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="bg-[var(--bg-body)]/50 rounded-xl p-3 border border-[var(--border)]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Vendas (Mês)</span>
                  <TrendingUp size={14} className="text-emerald-400" />
                </div>
                <div className="text-xl font-black text-[var(--text-main)]">
                  {formatCurrency(seller.totalVendas)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg-body)]/50 rounded-xl p-3 border border-[var(--border)] text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">Meta</span>
                  <span className={`text-sm font-bold ${seller.pctMeta >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {seller.pctMeta.toFixed(0)}%
                  </span>
                </div>
                <div className="bg-[var(--bg-body)]/50 rounded-xl p-3 border border-[var(--border)] text-center">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">Ligações</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {seller.ligacoesFeitas}
                  </span>
                </div>
              </div>
            </div>

            {/* Hover Action */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {/* DETAILED MODAL */}
      {selectedSeller && (
        <Modal
          isOpen
          onClose={() => setSelectedSeller(null)}
          size="4xl"
          title={
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-sm font-black uppercase shadow-lg shadow-cyan-500/20 bg-center bg-cover overflow-hidden"
                style={selectedSeller.avatarUrl ? { backgroundImage: `url(${selectedSeller.avatarUrl})` } : undefined}
              >
                {!selectedSeller.avatarUrl ? selectedSeller.name.substring(0, 2) : null}
              </div>
              <div className="min-w-0">
                <div className="text-base font-black text-cyan-400">Relatório de Performance Comercial</div>
                <div className="mt-0.5 text-xs text-[var(--text-soft)] truncate">
                  {selectedSeller.name}
                  {selectedSeller.performance?.ramal ? ` • Ramal ${selectedSeller.performance.ramal}` : ''}
                  {selectedSeller.performance?.email_corporativo ? ` • ${selectedSeller.performance.email_corporativo}` : ''}
                </div>
              </div>
              <div className="ml-auto">
                <span className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${selectedSeller.performance?.ativo === false ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {selectedSeller.performance?.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {!selectedSeller.performance ? (
              <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                <div className="text-sm text-[var(--text-muted)]">
                  Nenhum registro encontrado em <span className="font-bold">{currentMonthStr}</span> para este vendedor.
                </div>
              </div>
            ) : (
              (() => {
                const perf = selectedSeller.performance!;

                const parsePercent = (raw?: string | null) => {
                  const s = (raw || '').toString().trim();
                  if (!s) return 0;
                  const n = parseFloat(s.replace('%', '').replace(',', '.'));
                  if (!Number.isFinite(n)) return 0;
                  const normalized = n <= 1 ? n * 100 : n;
                  return Math.max(0, Math.min(100, normalized));
                };

                const money = (raw?: string | null) => {
                  if (!raw) return '-';
                  const n = parseValorProposta(raw);
                  return Number.isFinite(n) ? formatCurrency(n) : raw;
                };

                const progressoMetaMensal = parsePercent(perf.progresso_meta_mensal);
                const progressoLigacoes = parsePercent(perf.progresso_ligacoes);
                const progressoNovas = parsePercent(perf.novas_progresso_meta);

                const fases = [
                  { label: 'Prospecção', color: 'text-blue-400', qtd: perf.fase_prospeccao, val: perf.fase_prospeccao_valor },
                  { label: 'Qualificação', color: 'text-emerald-400', qtd: perf.fase_qualificacao, val: perf.fase_qualificacao_valor },
                  { label: 'Apresentação', color: 'text-amber-400', qtd: perf.fase_apresentacao, val: perf.fase_apresentacao_valor },
                  { label: 'Proposta', color: 'text-purple-400', qtd: perf.fase_proposta, val: perf.fase_proposta_valor },
                  { label: 'Negociação', color: 'text-rose-400', qtd: perf.fase_negociacao, val: perf.fase_negociacao_valor },
                ];

                return (
                  <>
                    <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] overflow-hidden">
                      <div className="px-6 py-5 border-b border-[var(--border)] bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-black text-cyan-400 flex items-center gap-2">
                              <TrendingUp size={16} />
                              Indicadores do Pipeline
                            </div>
                            <div className="mt-2 text-xs text-[var(--text-soft)]">
                              {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-[var(--text-soft)]">Progresso da Meta Mensal</div>
                            <div className="mt-0.5 text-sm font-black text-[var(--text-main)]">
                              {perf.progresso_meta_mensal || `${progressoMetaMensal.toFixed(0)}%`}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${progressoMetaMensal}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                            <div className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Pipeline</div>
                            <div className="mt-1 text-xl font-black text-rose-400">{perf.pipeline_funil || '-'}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                            <div className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Ticket Médio</div>
                            <div className="mt-1 text-xl font-black text-cyan-400">{money(perf.ticket_medio)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                            <div className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Vendas</div>
                            <div className="mt-1 text-xl font-black text-emerald-400">{money(perf.valor_vendido)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                            <div className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Valor em Produto</div>
                            <div className="mt-1 text-lg font-black text-purple-400">{money(perf.valor_produto)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                            <div className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Valor em Serviços</div>
                            <div className="mt-1 text-lg font-black text-amber-400">{money(perf.valor_servicos)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                      <div className="text-sm font-black text-cyan-400 flex items-center gap-2">
                        <Users size={16} />
                        KPIs do CRM
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-cyan-400">Em Andamento</div>
                          <div className="mt-2 text-sm text-[var(--text-soft)]">
                            Quantidade: <span className="text-[var(--text-main)] font-bold">{perf.quantidade_andamento}</span>
                          </div>
                          <div className="text-sm text-[var(--text-soft)]">
                            Valor: <span className="text-[var(--text-main)] font-bold">{money(perf.valor_andamento)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-emerald-400">Vendas</div>
                          <div className="mt-2 text-sm text-[var(--text-soft)]">
                            Quantidade: <span className="text-[var(--text-main)] font-bold">{perf.quantidade_vendido}</span>
                          </div>
                          <div className="text-sm text-[var(--text-soft)]">
                            Valor: <span className="text-[var(--text-main)] font-bold">{money(perf.valor_vendido)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-rose-400">Perdidas</div>
                          <div className="mt-2 text-sm text-[var(--text-soft)]">
                            <span className="text-[var(--text-main)] font-bold">{perf.quantidade_perdido}</span> •{' '}
                            <span className="text-[var(--text-main)] font-bold">{money(perf.valor_perdido)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-amber-400">Suspensas</div>
                          <div className="mt-2 text-sm text-[var(--text-soft)]">
                            <span className="text-[var(--text-main)] font-bold">{perf.quantidade_suspenso}</span> •{' '}
                            <span className="text-[var(--text-main)] font-bold">{money(perf.valor_suspenso)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-slate-300">Canceladas</div>
                          <div className="mt-2 text-sm text-[var(--text-soft)]">
                            <span className="text-[var(--text-main)] font-bold">{perf.quantidade_cancelado}</span> •{' '}
                            <span className="text-[var(--text-main)] font-bold">{money(perf.valor_cancelado)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                      <div className="text-sm font-black text-cyan-400 flex items-center gap-2">
                        <Target size={16} />
                        KPIs com Progresso
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-emerald-400">Meta Financeira</div>
                          <div className="mt-1 text-sm text-[var(--text-soft)]">{money(perf.meta_financeira_feita)}</div>
                          <div className="mt-3 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressoMetaMensal}%` }} />
                          </div>
                          <div className="mt-2 text-[10px] text-[var(--text-muted)] text-right font-bold">
                            {perf.progresso_meta_mensal || `${progressoMetaMensal.toFixed(0)}%`}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-cyan-400">Ligações Feitas</div>
                          <div className="mt-1 text-sm text-[var(--text-soft)]">{perf.ligacoes_feitas}</div>
                          <div className="mt-3 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${progressoLigacoes}%` }} />
                          </div>
                          <div className="mt-2 text-[10px] text-[var(--text-muted)] text-right font-bold">
                            {perf.progresso_ligacoes || `${progressoLigacoes.toFixed(0)}%`}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
                          <div className="text-xs font-black text-amber-400">Novas Propostas Comerciais</div>
                          <div className="mt-1 text-sm text-[var(--text-soft)]">{perf.novas_meta_feita}</div>
                          <div className="mt-3 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${progressoNovas}%` }} />
                          </div>
                          <div className="mt-2 text-[10px] text-[var(--text-muted)] text-right font-bold">
                            {perf.novas_progresso_meta || `${progressoNovas.toFixed(0)}%`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] overflow-hidden">
                      <div className="px-6 py-5 border-b border-[var(--border)] bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent">
                        <div className="text-base font-black text-cyan-400">Metas Diárias</div>
                        <div className="mt-1 text-xs text-[var(--text-soft)]">Prioridade máxima para execução hoje</div>
                      </div>

                      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-5">
                          <div className="text-xs font-black text-[var(--text-soft)]">Meta Financeira</div>
                          <div className="mt-2 text-3xl font-black text-emerald-400">{money(perf.meta_financeira_diaria)}</div>
                          <div className="mt-3 text-xs text-[var(--text-soft)]">
                            Meta Mensal: <span className="text-[var(--text-main)] font-bold">{money(perf.meta_financeira_total_mes)}</span>
                            <br />
                            Falta: <span className="text-rose-400 font-bold">{money(perf.meta_financeira_falta)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-5">
                          <div className="text-xs font-black text-[var(--text-soft)]">Meta Ligações</div>
                          <div className="mt-2 text-3xl font-black text-cyan-400">{perf.ligacoes_diarias}</div>
                          <div className="mt-3 text-xs text-[var(--text-soft)]">
                            Meta Mensal: <span className="text-[var(--text-main)] font-bold">{perf.ligacoes_total_mes}</span>
                            <br />
                            Falta: <span className="text-rose-400 font-bold">{perf.ligacoes_falta}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-5">
                          <div className="text-xs font-black text-[var(--text-soft)]">Novas Propostas Comerciais</div>
                          <div className="mt-2 text-3xl font-black text-amber-400">{perf.novas_meta_diaria}</div>
                          <div className="mt-3 text-xs text-[var(--text-soft)]">
                            Meta Mensal: <span className="text-[var(--text-main)] font-bold">{perf.novas_meta_total_mes}</span>
                            <br />
                            Falta: <span className="text-rose-400 font-bold">{perf.novas_meta_falta}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                      <div className="text-sm font-black text-cyan-400 flex items-center gap-2">
                        <BarChart2 size={16} />
                        Funil de Vendas
                      </div>

                      <div className="mt-4 rounded-2xl border border-[var(--border)] overflow-hidden">
                        <div className="divide-y divide-[var(--border)]">
                          {fases.map((f) => (
                            <div key={f.label} className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--bg-panel)]/30">
                              <div className={`text-sm font-black ${f.color}`}>{f.label}</div>
                              <div className="text-sm text-[var(--text-main)] font-bold">
                                {f.qtd.toLocaleString('pt-BR')} • {money(f.val)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Vendedores;
