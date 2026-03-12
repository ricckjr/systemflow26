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
import { useOportunidades, usePabxLigacoes, useVendedoresPerformance, useRelatorioMensalVendedor, useRelatoriosMensais } from '@/hooks/useCRM';
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format';
import { formatDateBR } from '@/utils/datetime';
import { Modal } from '@/components/ui';
import { format, isSameMonth, parseISO, parse, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CRM_RelatorioMensalVendedor } from '@/services/crm';

// Configuration
const META_INDIVIDUAL = 50000; // R$ 50.000,00

interface SellerStats {
  idUser?: string | null;
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
  novasOpsFeitas: number;
  relatorio?: CRM_RelatorioMensalVendedor | null;
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
  const { data: relatoriosMensaisData } = useRelatoriosMensais(currentMonthStr);
  
  const allVendedoresPerformance = vendedoresPerformanceData || [];
  const allRelatoriosMensais = relatoriosMensaisData || [];

  const vendedoresPerformanceByName = useMemo(() => {
    const map = new Map<string, CRM_VendedorPerformance>();
    allVendedoresPerformance.forEach((p) => {
      const key = (p.vendedor || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, p);
    });
    return map;
  }, [allVendedoresPerformance]);

  // Map relatorios mensais by user ID (preferred) or name (fallback)
  const relatoriosMap = useMemo(() => {
    const map = new Map<string, CRM_RelatorioMensalVendedor>();
    allRelatoriosMensais.forEach((r) => {
      if (r.id_user) map.set(r.id_user, r);
      if (r.vendedor) map.set(r.vendedor.trim().toLowerCase(), r);
    });
    return map;
  }, [allRelatoriosMensais]);

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
      idUser?: string | null;
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
      if (!sellerMap[sellerName].idUser && op.id_vendedor) {
        sellerMap[sellerName].idUser = op.id_vendedor;
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
        sellerMap[sellerName].ligacoesFeitas += lig.total_ligacoes_realizadas;
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
    
    // 4. Ensure sellers from monthly report table appear
    allRelatoriosMensais.forEach((r) => {
       const sellerName = r.vendedor || 'Não Atribuído';
       if (!sellerMap[sellerName]) {
          sellerMap[sellerName] = {
            totalVendas: 0,
            prevTotalVendas: 0,
            countVendas: 0,
            totalOps: 0,
            ops: [],
            ligacoesFeitas: 0,
            ligacoesNaoAtendidas: 0,
            idUser: r.id_user
          };
       } else if (!sellerMap[sellerName].idUser && r.id_user) {
         sellerMap[sellerName].idUser = r.id_user;
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
      
      // Try to find relatorio by ID or Name
      let relatorio = data.idUser ? relatoriosMap.get(data.idUser) : null;
      if (!relatorio) {
        relatorio = relatoriosMap.get(name.trim().toLowerCase()) || null;
      }

      // Priority: Relatorio Table > Performance View > Calculated Data
      
      const meta = relatorio 
        ? parseValorProposta(relatorio.meta_financeira_total_mes)
        : (perf ? parseValorProposta(perf.meta_financeira_total_mes) : META_INDIVIDUAL);
      
      const totalVendas = relatorio
        ? parseValorProposta(relatorio.valor_vendido)
        : (perf ? parseValorProposta(perf.valor_vendido) : data.totalVendas);
        
      const totalOportunidades = relatorio
        ? relatorio.total_pipeline_quantidade
        : (perf ? perf.total_quantidade_oportunidades : data.totalOps);
        
      const ligacoesFeitas = relatorio
        ? relatorio.ligacoes_feitas
        : (perf ? perf.ligacoes_feitas : data.ligacoesFeitas);
        
      const vendasFeitas = relatorio
        ? relatorio.quantidade_vendido
        : (perf ? perf.quantidade_vendido : data.countVendas);
        
      const novasOpsFeitas = relatorio
        ? relatorio.novas_meta_feita
        : (perf ? perf.novas_meta_feita : data.totalOps); 

      const taxaConversao = relatorio
        ? relatorio.taxa_conversao_real
        : (perf ? parsePercent(perf.taxa_conversao_real) : (data.totalOps > 0 ? (data.countVendas / data.totalOps) * 100 : 0));
        
      const ticketMedio = relatorio
        ? parseValorProposta(relatorio.ticket_medio)
        : (perf ? parseValorProposta(perf.ticket_medio) : (data.countVendas > 0 ? data.totalVendas / data.countVendas : 0));

      const pctMeta = relatorio 
        ? relatorio.percentual_meta_mensal // Use directly from table
        : (perf ? parsePercent(perf.progresso_meta_mensal || perf.percentual_meta_financeira) : ((totalVendas / (meta || 1)) * 100));

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
        idUser: relatorio?.id_user ?? perf?.id_user ?? data.idUser ?? null,
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
        ligacoesNaoAtendidas: relatorio ? relatorio.ligacoes_nao_atendidas : data.ligacoesNaoAtendidas,
        trendVendas,
        avatarUrl: (String(perf?.avatar_url || '').trim() || null) ?? data.avatarUrl ?? null,
        emailCorporativo: perf?.email_corporativo ?? null,
        telefone: perf?.telefone ?? null,
        ramal: relatorio?.ramal ?? perf?.ramal ?? null,
        performance: perf,
        novasOpsFeitas,
        relatorio: relatorio
      };
    });

    // Sort by sales (Ranking)
    sellerArray.sort((a, b) => b.totalVendas - a.totalVendas);
    sellerArray.forEach((s, i) => s.ranking = i + 1);

    return sellerArray;

  }, [allOportunidades, allLigacoes, allVendedoresPerformance, allRelatoriosMensais, vendedoresPerformanceByName, relatoriosMap, selectedMonth, currentMonthStr, prevMonth]);

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
          <p className="text-xs text-[var(--text-soft)] ml-14">Vendedores e indicadores de desempenho individual</p>
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
              <div className="text-sm font-black text-[var(--text-main)]">Medalhas dos Vendedores</div>
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
                if (ranking === 1) return { 
                  label: 'Medalha de Ouro', 
                  ring: 'border-yellow-400', 
                  glow: 'shadow-yellow-500/40', 
                  bg: 'from-yellow-500/20 via-yellow-500/5 to-transparent', 
                  text: 'text-yellow-400',
                  icon: <Trophy size={20} className="text-yellow-400" />
                };
                if (ranking === 2) return { 
                  label: 'Medalha de Prata', 
                  ring: 'border-slate-300', 
                  glow: 'shadow-slate-500/30', 
                  bg: 'from-slate-500/20 via-slate-500/5 to-transparent', 
                  text: 'text-slate-300',
                  icon: <Award size={20} className="text-slate-300" />
                };
                return { 
                  label: 'Medalha de Bronze', 
                  ring: 'border-orange-400', 
                  glow: 'shadow-orange-500/30', 
                  bg: 'from-orange-500/20 via-orange-500/5 to-transparent', 
                  text: 'text-orange-400',
                  icon: <Award size={20} className="text-orange-400" />
                };
              };

              const top1 = sellers[0];
              const top2 = sellers[1];
              const top3 = sellers[2];

              const MedalCard = ({ seller, size }: { seller: SellerStats; size: 'lg' | 'sm' }) => {
                const m = medal(seller.ranking);
                const pct = Math.max(0, Math.min(100, seller.pctMeta || 0));
                const avatarSize = size === 'lg' ? 'w-32 h-32 text-4xl' : 'w-24 h-24 text-3xl';
                const pad = size === 'lg' ? 'p-8' : 'p-6';
                const height = size === 'lg' ? 'min-h-[380px]' : 'min-h-[340px]';

                return (
                  <button
                    type="button"
                    onClick={() => setSelectedSeller(seller)}
                    className={`relative w-full flex flex-col justify-between ${pad} ${height} rounded-3xl border border-[var(--border)] bg-gradient-to-b ${m.bg} shadow-2xl ${m.glow} text-left hover:scale-[1.02] hover:border-cyan-500/30 transition-all duration-300 group overflow-hidden`}
                  >
                    {/* Background Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="flex flex-col items-center justify-center gap-5 w-full z-10">
                      <div className="relative">
                        <div
                          className={`${avatarSize} rounded-full flex items-center justify-center font-black uppercase border-4 ${m.ring} bg-[var(--bg-panel)] shadow-2xl bg-center bg-cover transition-transform duration-500 group-hover:rotate-3`}
                          style={seller.avatarUrl ? { backgroundImage: `url(${seller.avatarUrl})` } : undefined}
                        >
                          {!seller.avatarUrl ? seller.name.substring(0, 2) : null}
                        </div>
                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--bg-panel)] border ${m.ring} flex items-center gap-1.5 shadow-lg whitespace-nowrap`}>
                           {m.icon}
                           <span className={`text-[10px] font-black uppercase tracking-widest ${m.text}`}>{size === 'lg' ? '1º Lugar' : `${seller.ranking}º Lugar`}</span>
                        </div>
                      </div>
                      
                      <div className="text-center min-w-0 w-full mt-2">
                        <div className={`font-black text-[var(--text-main)] truncate tracking-tight ${size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>{seller.name}</div>
                        <div className={`mt-1 font-bold uppercase tracking-wider text-[10px] ${m.text}`}>{m.label}</div>
                        <div className="mt-3 inline-block px-4 py-1.5 rounded-xl bg-[var(--bg-body)]/50 border border-[var(--border)] text-sm font-black text-[var(--text-main)] shadow-inner">
                          {formatCurrency(seller.totalVendas)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 w-full z-10">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        <span>Meta Mensal</span>
                        <span className={`${pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-[var(--bg-body)]/50 h-2.5 rounded-full overflow-hidden border border-[var(--border)] backdrop-blur-sm">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${pct >= 100 ? 'from-emerald-500 to-emerald-400' : 'from-cyan-500 to-blue-500'} shadow-[0_0_10px_rgba(6,182,212,0.5)]`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              };

              return (
                <div className="mt-8 relative rounded-3xl border border-[var(--border)] bg-[var(--bg-body)]/30 overflow-hidden pt-16 pb-6 px-6 sm:px-12 sm:pb-12">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-[var(--bg-body)] to-transparent opacity-50" />
                  
                  <div className="relative flex flex-col md:flex-row items-end justify-center gap-6 md:gap-8 h-full max-w-5xl mx-auto">
                    {/* 2nd Place */}
                    <div className="w-full md:w-1/3 order-2 md:order-1 flex items-end">
                      {top2 && <div className="w-full transform transition-transform hover:-translate-y-2 duration-300"><MedalCard seller={top2} size="sm" /></div>}
                    </div>
                    
                    {/* 1st Place */}
                    <div className="w-full md:w-1/3 order-1 md:order-2 flex items-end -mt-0 md:-mt-12 mb-0 md:mb-10 z-20">
                      {top1 && <div className="w-full transform scale-105 transition-transform hover:-translate-y-2 duration-300 shadow-[0_0_50px_-12px_rgba(234,179,8,0.3)] rounded-3xl"><MedalCard seller={top1} size="lg" /></div>}
                    </div>

                    {/* 3rd Place */}
                    <div className="w-full md:w-1/3 order-3 md:order-3 flex items-end">
                      {top3 && <div className="w-full transform transition-transform hover:-translate-y-2 duration-300"><MedalCard seller={top3} size="sm" /></div>}
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
                  <th className="py-4 pr-3 text-left text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Vendedor</th>
                  <th className="py-4 pr-3 text-right text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Venda Feita (R$)</th>
                  <th className="py-4 pr-3 text-right text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Novas Ops Feitas</th>
                  <th className="py-4 pr-3 text-right text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Ligações Feitas</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => {
                  const pct = seller.pctMeta;
                  const rankBg =
                    seller.ranking === 1
                      ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20'
                      : seller.ranking === 2
                        ? 'bg-slate-300/15 text-slate-300 border-slate-400/20'
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
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-3 text-right font-black text-emerald-400">
                        {formatCurrency(seller.totalVendas)}
                      </td>
                      <td className="py-4 pr-3 text-right font-bold text-[var(--text-main)]">
                        {seller.novasOpsFeitas}
                      </td>
                      <td className="py-4 pr-3 text-right font-bold text-cyan-400">
                        {seller.ligacoesFeitas}
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
            <RelatorioVendedorModalContent seller={selectedSeller} monthStr={currentMonthStr} oportunidades={allOportunidades} />
          </div>
        </Modal>
      )}
    </div>
  );
};

const RelatorioVendedorModalContent: React.FC<{ 
  seller: SellerStats; 
  monthStr: string; 
  oportunidades: CRM_Oportunidade[];
}> = ({ seller, monthStr, oportunidades }) => {
  const { data: relatorio, isLoading } = useRelatorioMensalVendedor(seller.idUser || undefined, monthStr);
  const monthDate = useMemo(() => parse(monthStr, 'MM-yyyy', new Date()), [monthStr]);
  const vendasDoVendedorNoMes = useMemo(() => {
    const statusVendaId = 'c8535d23-d002-4dbd-9bbe-9be97c2097ba';
    const list = (oportunidades || []).filter((op) => {
      if (!op) return false;
      if (String(op.id_status || '').trim() !== statusVendaId) return false;

      const sameSeller = seller.idUser
        ? String(op.id_vendedor || '').trim() === String(seller.idUser || '').trim()
        : String(op.vendedor || '').trim().toLowerCase() === String(seller.name || '').trim().toLowerCase();
      if (!sameSeller) return false;

      const dateStr = op.data_conquistado || op.data_inclusao || op.data_alteracao;
      if (!dateStr) return false;
      return isSameMonth(parseISO(dateStr), monthDate);
    });

    return list.sort((a, b) => {
      const da = a.data_conquistado || a.data_inclusao || a.data_alteracao || '';
      const db = b.data_conquistado || b.data_inclusao || b.data_alteracao || '';
      return String(db).localeCompare(String(da));
    });
  }, [oportunidades, seller.idUser, seller.name, monthDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-cyan-500 gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-panel)] flex items-center justify-center text-[var(--text-muted)] mb-3">
          <TrendingUp size={24} />
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          Nenhum relatório detalhado encontrado para <span className="font-bold text-[var(--text-main)]">{monthStr}</span>.
        </div>
      </div>
    );
  }

  const money = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    if (typeof val === 'number') return formatCurrency(val);
    return val;
  };

  const percent = (val: number | null | undefined) => {
    if (val == null) return '0%';
    return `${val.toFixed(1)}%`;
  };

  const int = (val: number | null | undefined) => {
    if (val == null) return 0;
    return val;
  };

  const supermetaTotal = parseValorProposta(relatorio.supermeta_financeira_total_mes);
  const supermetaFeita = parseValorProposta(relatorio.supermeta_financeira_feita);
  const supermetaFalta = Math.max(0, supermetaTotal - supermetaFeita);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Resumo Principal (Meta Financeira) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-400 uppercase tracking-wider">
              <DollarSign size={16} />
              Meta Financeira
            </div>
            <div className={`text-xs font-black px-2 py-1 rounded-lg border ${relatorio.percentual_meta_mensal >= 100 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border-amber-500/20'}`}>
              {percent(relatorio.percentual_meta_mensal)} Atingida
            </div>
          </div>
          
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black text-[var(--text-main)]">{money(relatorio.meta_financeira_feita)}</div>
            <div className="text-sm text-[var(--text-soft)] mb-1.5">/ {money(relatorio.meta_financeira_total_mes)}</div>
          </div>

          <div className="mt-4 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-emerald-500/10">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, relatorio.percentual_meta_mensal)}%` }} 
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[var(--text-soft)]">Falta</div>
              <div className="font-bold text-rose-400">{money(relatorio.meta_financeira_falta)}</div>
            </div>
            <div>
              <div className="text-[var(--text-soft)]">Meta Diária</div>
              <div className="font-bold text-[var(--text-main)]">{money(relatorio.meta_financeira_diaria)}</div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent p-6">
           <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-400 uppercase tracking-wider">
              <Phone size={16} />
              Ligações
            </div>
            <div className={`text-xs font-black px-2 py-1 rounded-lg border ${relatorio.progresso_ligacoes >= 100 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}`}>
              {percent(relatorio.progresso_ligacoes)} Realizado
            </div>
          </div>
          
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black text-[var(--text-main)]">{int(relatorio.ligacoes_feitas)}</div>
            <div className="text-sm text-[var(--text-soft)] mb-1.5">/ {int(relatorio.ligacoes_falta)} (Restantes)</div>
          </div>

          <div className="mt-4 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-cyan-500/10">
            <div 
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, relatorio.progresso_ligacoes)}%` }} 
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[var(--text-soft)]">Meta Diária</div>
              <div className="font-bold text-[var(--text-main)]">{int(relatorio.ligacoes_diarias)}</div>
            </div>
            <div>
              <div className="text-[var(--text-soft)]">Não Atendidas</div>
              <div className="font-bold text-rose-400">{int(relatorio.ligacoes_nao_atendidas)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Supermeta e Novas Oportunidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/50 p-5">
           <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider mb-3">
              <Star size={14} />
              Supermeta
            </div>
            <div className="flex justify-between items-end mb-2">
              <div className="text-xl font-black text-[var(--text-main)]">{money(relatorio.supermeta_financeira_feita)}</div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Meta: {money(relatorio.supermeta_financeira_total_mes)}</div>
            </div>
            <div className="w-full bg-[var(--bg-body)] h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, relatorio.percentual_supermeta_financeira)}%` }} />
            </div>
            <div className="mt-3 text-xs flex items-center justify-between">
              <div className="text-[var(--text-soft)]">Falta para bater</div>
              <div className={`font-black ${supermetaFalta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(supermetaFalta)}
              </div>
            </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-5">
           <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-black text-purple-400 uppercase tracking-wider">
              <Target size={16} />
              Novas Oportunidades
            </div>
             <div className={`text-xs font-black px-2 py-1 rounded-lg border ${relatorio.novas_progresso_meta >= 100 ? 'bg-purple-500/20 text-purple-400 border-purple-500/20' : 'bg-amber-500/20 text-amber-400 border-amber-500/20'}`}>
              {percent(relatorio.novas_progresso_meta)} Atingida
            </div>
           </div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black text-[var(--text-main)]">{int(relatorio.novas_meta_feita)}</div>
            <div className="text-sm text-[var(--text-soft)] mb-1.5">/ {int(relatorio.novas_meta_total_mes)}</div>
          </div>

          <div className="mt-4 w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden border border-purple-500/10">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, relatorio.novas_progresso_meta)}%` }} 
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[var(--text-soft)]">Meta Diária</div>
              <div className="font-bold text-[var(--text-main)]">{int(relatorio.novas_meta_diaria)}</div>
            </div>
            <div>
              <div className="text-[var(--text-soft)]">Falta</div>
              <div className="font-bold text-rose-400">{int(relatorio.novas_meta_falta)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Indicadores de Performance */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-6">
        <div className="text-sm font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-cyan-400" />
          Indicadores de Performance
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-center">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Taxa de Conversão</div>
            <div className="text-lg font-black text-emerald-400">{percent(relatorio.taxa_conversao_real)}</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-center">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Ticket Médio</div>
            <div className="text-lg font-black text-cyan-400">{money(relatorio.ticket_medio)}</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-center">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Temperatura</div>
            <div className="text-lg font-black text-amber-400">{int(relatorio.temperatura_media)}°</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-center">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Pipeline Total</div>
            <div className="text-lg font-black text-[var(--text-main)]">{money(relatorio.total_pipeline_valor)}</div>
          </div>
        </div>
      </div>

      {/* 4. Funil de Vendas Detalhado */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
         <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-body)]/50 flex justify-between items-center">
            <div className="text-sm font-black text-[var(--text-main)] flex items-center gap-2">
              <BarChart2 size={16} className="text-cyan-400" />
              Funil de Vendas Detalhado
            </div>
         </div>
         <div className="divide-y divide-[var(--border)]">
           {[
             { label: 'Lead', qtd: relatorio.fase_lead_quantidade, val: relatorio.fase_lead_valor, color: 'text-sky-400' },
             { label: 'Lead Qualificado', qtd: relatorio.fase_lead_qualificados_quantidade, val: relatorio.fase_lead_qualificados_valor, color: 'text-blue-400' },
             { label: 'Negociação', qtd: relatorio.fase_negociacao_quantidade, val: relatorio.fase_negociacao_valor, color: 'text-purple-400' },
             { label: 'Em Produção', qtd: relatorio.fase_em_producao_quantidade, val: relatorio.fase_em_producao_valor, color: 'text-indigo-400' },
             { label: 'Controle de Qualidade', qtd: relatorio.fase_controle_qualidade_quantidade, val: relatorio.fase_controle_qualidade_valor, color: 'text-amber-400' },
             { label: 'Pós-venda', qtd: relatorio.fase_pos_venda_quantidade, val: relatorio.fase_pos_venda_valor, color: 'text-emerald-400' },
           ].map((item) => (
             <div key={item.label} className="px-6 py-3 flex items-center justify-between hover:bg-[var(--bg-body)]/30 transition-colors">
               <div className={`text-sm font-bold ${item.color}`}>{item.label}</div>
               <div className="text-right">
                 <div className="text-sm font-black text-[var(--text-main)]">{money(item.val)}</div>
                 <div className="text-[10px] text-[var(--text-muted)]">{int(item.qtd)} oportunidades</div>
               </div>
             </div>
           ))}
         </div>
      </div>

      {/* 5. Vendas do Mês */}
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-body)]/50 flex justify-between items-center">
          <div className="text-sm font-black text-[var(--text-main)] flex items-center gap-2">
            <Trophy size={16} className="text-emerald-400" />
            Vendas do Mês
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {monthStr}
          </div>
        </div>

        <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--bg-panel)]">
              <tr className="text-[10px] uppercase tracking-wider font-black text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-3 px-6 text-left">Data Inclusão</th>
                <th className="py-3 pr-3 text-left">Data Conquista</th>
                <th className="py-3 pr-3 text-left">Código</th>
                <th className="py-3 pr-3 text-left">Cliente</th>
                <th className="py-3 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {vendasDoVendedorNoMes.map((op) => {
                const valor = parseValorProposta(op.valor_proposta ?? (op.ticket_valor == null ? null : String(op.ticket_valor)));
                return (
                  <tr key={op.id_oport} className="border-b border-[var(--border)] hover:bg-[var(--bg-body)]/30 transition-colors">
                    <td className="py-3 px-6 text-xs text-[var(--text-soft)] whitespace-nowrap">
                      {formatDateBR(op.data_inclusao) || '-'}
                    </td>
                    <td className="py-3 pr-3 text-xs text-[var(--text-soft)] whitespace-nowrap">
                      {formatDateBR(op.data_conquistado) || '-'}
                    </td>
                    <td className="py-3 pr-3 font-bold text-[var(--text-main)] whitespace-nowrap">
                      {op.cod_oport || '-'}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-main)]">
                      {op.cliente || op.cliente_nome || '-'}
                    </td>
                    <td className="py-3 pr-3 text-right font-black text-emerald-400 whitespace-nowrap">
                      {formatCurrency(valor)}
                    </td>
                  </tr>
                );
              })}

              {vendasDoVendedorNoMes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 px-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhuma venda encontrada para este vendedor em {monthStr}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Vendedores;
