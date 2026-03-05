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
  vendasFeitas: number;
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
      avatarUrl?: string | null;
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
      if (!sellerMap[sellerName].avatarUrl && (op as any)?.vendedor_avatar_url) {
        sellerMap[sellerName].avatarUrl = String((op as any).vendedor_avatar_url || '').trim() || null;
      }

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
      const vendasFeitas = perf ? perf.quantidade_vendido : data.countVendas;

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
        vendasFeitas,
        vendasPorDia,
        historico: data.ops,
        ligacoesFeitas,
        ligacoesNaoAtendidas: data.ligacoesNaoAtendidas,
        trendVendas,
        avatarUrl: (String(perf?.avatar_url || '').trim() || null) ?? data.avatarUrl ?? null,
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

      <div className="space-y-6">
        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-black text-[var(--text-main)]">Ranking de Medalhas</div>
              <div className="mt-1 text-xs text-[var(--text-soft)] truncate">Top 3 do mês + progresso da meta mensal</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {sellers.length} vendedores
            </div>
          </div>

          {sellers.length === 0 ? (
            <div className="mt-6 bg-[var(--bg-body)]/40 border border-[var(--border)] rounded-2xl p-6 text-sm text-[var(--text-muted)]">
              Nenhum dado disponível para este mês.
            </div>
          ) : (
            (() => {
              const medal = (ranking: number) => {
                if (ranking === 1) return { label: '1º • Dourado', ring: 'border-amber-400', glow: 'shadow-amber-500/20', bg: 'from-amber-500/15 via-amber-500/5 to-transparent', text: 'text-amber-400' };
                if (ranking === 2) return { label: '2º • Prata', ring: 'border-slate-300', glow: 'shadow-slate-500/15', bg: 'from-slate-500/15 via-slate-500/5 to-transparent', text: 'text-slate-200' };
                return { label: '3º • Bronze', ring: 'border-orange-400', glow: 'shadow-orange-500/15', bg: 'from-orange-500/15 via-orange-500/5 to-transparent', text: 'text-orange-400' };
              };

              const top1 = sellers[0];
              const top2 = sellers[1];
              const top3 = sellers[2];

              const MedalCard = ({ seller, size }: { seller: SellerStats; size: 'lg' | 'sm' }) => {
                const m = medal(seller.ranking);
                const pct = Math.max(0, Math.min(100, seller.pctMeta || 0));
                const avatarSize = size === 'lg' ? 'w-28 h-28 text-3xl' : 'w-20 h-20 text-2xl';
                const pad = size === 'lg' ? 'p-7' : 'p-6';
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedSeller(seller)}
                    className={`relative flex-1 ${pad} rounded-2xl border border-[var(--border)] bg-gradient-to-b ${m.bg} shadow-xl ${m.glow} text-left hover:border-cyan-500/40 transition-colors overflow-hidden`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className={`text-[10px] font-black uppercase tracking-wider ${m.text}`}>{m.label}</div>
                        <div className={`mt-1 font-black text-[var(--text-main)] truncate ${size === 'lg' ? 'text-lg sm:text-xl' : 'text-base'}`}>{seller.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-soft)]">Vendas: {formatCurrency(seller.totalVendas)}</div>
                      </div>
                      <div
                        className={`${avatarSize} rounded-full flex items-center justify-center font-black uppercase border-4 ${m.ring} bg-[var(--bg-panel)] shadow-xl bg-center bg-cover`}
                        style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}
                      >
                        {!seller.avatarUrl ? seller.name.substring(0, 2) : null}
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Progresso da Meta</span>
                        <span className={`${pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="mt-2.5 w-full bg-[var(--bg-panel)] h-2.5 rounded-full overflow-hidden border border-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              };

              return (
                <div className="mt-6 relative rounded-2xl border border-[var(--border)] bg-[var(--bg-body)]/20 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent" />
                  <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-cyan-500/10 blur-3xl" />
                  <div className="relative p-5 sm:p-7">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-center gap-6">
                      <div className="hidden lg:flex flex-1 items-end">
                        {top2 ? <MedalCard seller={top2} size="sm" /> : null}
                      </div>
                      <div className="flex flex-1 items-end">
                        {top1 ? <MedalCard seller={top1} size="lg" /> : null}
                      </div>
                      <div className="hidden lg:flex flex-1 items-end">
                        {top3 ? <MedalCard seller={top3} size="sm" /> : null}
                      </div>
                    </div>

                    <div className="mt-6 lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {top2 ? <MedalCard seller={top2} size="sm" /> : null}
                      {top3 ? <MedalCard seller={top3} size="sm" /> : null}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-black text-[var(--text-main)]">Vendedores</div>
              <div className="mt-1 text-xs text-[var(--text-soft)] truncate">Vendas do mês, metas, ligações e vendas feitas</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              {currentMonthStr}
            </div>
          </div>

          <div className="mt-5 max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--bg-panel)]">
                <tr className="text-[10px] uppercase tracking-wider font-black text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="py-3 pr-3 text-left w-[70px]">Rank</th>
                  <th className="py-3 pr-3 text-left min-w-[260px]">Vendedor</th>
                  <th className="py-3 pr-3 text-right min-w-[160px]">Vendas do mês</th>
                  <th className="py-3 pr-3 text-right min-w-[200px]">Meta</th>
                  <th className="py-3 pr-3 text-right min-w-[120px]">Ligações</th>
                  <th className="py-3 text-right min-w-[140px]">Vendas feitas</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => {
                  const pct = Math.max(0, Math.min(100, seller.pctMeta || 0));
                  const rankBg =
                    seller.ranking === 1
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                      : seller.ranking === 2
                        ? 'bg-slate-500/15 text-slate-200 border-slate-500/20'
                        : seller.ranking === 3
                          ? 'bg-orange-500/15 text-orange-300 border-orange-500/20'
                          : 'bg-[var(--bg-body)]/30 text-[var(--text-muted)] border-[var(--border)]';

                  return (
                    <tr
                      key={seller.name}
                      onClick={() => setSelectedSeller(seller)}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-body)]/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 pr-3">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg border text-xs font-black ${rankBg}`}>
                          #{seller.ranking}
                        </span>
                      </td>
                      <td className="py-4 pr-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full bg-[var(--bg-body)] border border-[var(--border)] bg-center bg-cover flex items-center justify-center font-black uppercase text-[11px] text-[var(--text-main)]"
                            style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}
                          >
                            {!seller.avatarUrl ? seller.name.substring(0, 2) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[var(--text-main)] truncate">{seller.name}</div>
                            <div className="text-[11px] text-[var(--text-soft)] truncate">
                              Meta: {pct.toFixed(0)}% • Oportunidades: {seller.totalOportunidades}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-3 text-right font-black text-[var(--text-main)]">
                        {formatCurrency(seller.totalVendas)}
                      </td>
                      <td className="py-4 pr-3 text-right">
                        <div className="font-bold text-[var(--text-main)]">{formatCurrency(seller.meta)}</div>
                        <div className="mt-2 w-full bg-[var(--bg-body)]/40 h-2 rounded-full overflow-hidden border border-[var(--border)]">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="py-4 pr-3 text-right font-bold text-cyan-400">
                        {seller.ligacoesFeitas}
                      </td>
                      <td className="py-4 text-right font-bold text-emerald-400">
                        {seller.vendasFeitas}
                      </td>
                    </tr>
                  );
                })}
                {sellers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[var(--text-muted)]">
                      Nenhum vendedor encontrado para este mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
