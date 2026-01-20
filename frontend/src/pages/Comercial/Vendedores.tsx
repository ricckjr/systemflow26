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
import { CRM_Oportunidade, isVenda } from '@/services/crm';
import { useOportunidades, usePabxLigacoes } from '@/hooks/useCRM';
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format';
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
}

const Vendedores: React.FC = () => {
  // React Query Hook
  const { data: oportunidadesData, isLoading: loadingOps } = useOportunidades();
  const { data: ligacoesData, isLoading: loadingLig } = usePabxLigacoes();
  
  const allOportunidades = oportunidadesData || [];
  const allLigacoes = ligacoesData || [];

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  // Process data when opportunities or month changes
  const sellers = useMemo(() => {
    // Format selectedMonth to "MM-yyyy" for PABX data matching
    const currentMonthStr = format(selectedMonth, 'MM-yyyy');
    const prevMonth = subMonths(selectedMonth, 1);

    // Filter Current Month
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
        const valor = parseValorProposta(op.valor_proposta);
        sellerMap[sellerName].totalVendas += valor;
        sellerMap[sellerName].countVendas += 1;
      }
    });

    // 1.1 Process Previous Month Opportunities (for Trend)
    prevFilteredOps.forEach(op => {
      if (isVenda(op.status)) {
        const sellerName = op.vendedor || 'Não Atribuído';
        
        if (sellerMap[sellerName]) {
           const valor = parseValorProposta(op.valor_proposta);
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

    // Transform to array
    const sellerArray: SellerStats[] = Object.entries(sellerMap).map(([name, data]) => {
      const taxaConversao = data.totalOps > 0 ? (data.countVendas / data.totalOps) * 100 : 0;
      const ticketMedio = data.countVendas > 0 ? data.totalVendas / data.countVendas : 0;
      const pctMeta = (data.totalVendas / META_INDIVIDUAL) * 100;

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
        const day = format(parseISO(o.data_inclusao!), 'dd/MM');
        const val = parseValorProposta(o.valor_proposta);
        salesByDayMap[day] = (salesByDayMap[day] || 0) + val;
      });
      const vendasPorDia = Object.entries(salesByDayMap).map(([dia, valor]) => ({ dia, valor })).sort((a, b) => a.dia.localeCompare(b.dia));

      return {
        name,
        totalVendas: data.totalVendas,
        totalOportunidades: data.totalOps,
        taxaConversao,
        ticketMedio,
        meta: META_INDIVIDUAL,
        pctMeta,
        ranking: 0, // Will sort next
        vendasPorDia,
        historico: data.ops,
        ligacoesFeitas: data.ligacoesFeitas,
        ligacoesNaoAtendidas: data.ligacoesNaoAtendidas,
        trendVendas
      };
    });

    // Sort by sales (Ranking)
    sellerArray.sort((a, b) => b.totalVendas - a.totalVendas);
    sellerArray.forEach((s, i) => s.ranking = i + 1);

    return sellerArray;

  }, [allOportunidades, allLigacoes, selectedMonth]);

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
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold uppercase border-4 shadow-xl
                   ${seller.ranking === 1 ? 'border-amber-400 text-amber-500 bg-amber-500/10' : 'border-[var(--bg-body)] text-[var(--primary)] bg-[var(--primary)]/10'}
                `}>
                  {seller.name.substring(0, 2)}
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-sm font-bold uppercase shadow-lg shadow-cyan-500/20">
                {selectedSeller.name.substring(0, 2)}
              </div>
              <div>
                <h3 className="text-lg font-black text-[var(--text-main)]">{selectedSeller.name}</h3>
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-soft)]">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
                  <span>•</span>
                  <span>{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</span>
                </div>
              </div>
            </div>
          }
        >
          <div className="space-y-8">
              
              {/* Top KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <DollarSign size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Vendas Totais</p>
                  <p className="text-2xl font-black text-[var(--text-main)]">{formatCurrency(selectedSeller.totalVendas)}</p>
                  <div className={`text-[10px] mt-2 font-bold flex items-center gap-1 ${selectedSeller.trendVendas >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <TrendingUp size={10} className={selectedSeller.trendVendas < 0 ? 'rotate-180' : ''} /> 
                    {selectedSeller.trendVendas >= 0 ? '+' : ''}{selectedSeller.trendVendas.toFixed(1)}% vs mês anterior
                  </div>
                </div>

                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Target size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Atingimento Meta</p>
                  <p className={`text-2xl font-black ${selectedSeller.pctMeta >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedSeller.pctMeta.toFixed(1)}%
                  </p>
                  <div className="w-full bg-[var(--bg-panel)] h-1.5 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${selectedSeller.pctMeta >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                      style={{ width: `${Math.min(selectedSeller.pctMeta, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* KPI de Ligações */}
                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Phone size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Ligações Realizadas</p>
                  <p className="text-2xl font-black text-blue-400">{selectedSeller.ligacoesFeitas}</p>
                  <p className="text-[10px] text-rose-400 mt-2 font-medium flex items-center gap-1">
                     <PhoneMissed size={10} /> {selectedSeller.ligacoesNaoAtendidas} não atendidas
                  </p>
                </div>

                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <BarChart2 size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Ticket Médio</p>
                  <p className="text-2xl font-black text-[var(--text-main)]">{formatCurrency(selectedSeller.ticketMedio)}</p>
                  <p className="text-[10px] text-[var(--text-soft)] mt-2">
                    Por venda realizada
                  </p>
                </div>
              </div>

              {/* Charts & Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Detailed Metrics List - FULL WIDTH */}
                <div className="lg:col-span-3 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6 flex flex-col">
                  <h4 className="text-sm font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                    <Target size={16} className="text-amber-400" />
                    Detalhamento de Performance
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Column 1 */}
                    <div className="space-y-6">
                        {/* Meta Financeira */}
                        <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-medium text-[var(--text-soft)]">Meta Financeira</span>
                            <span className="text-xs font-bold text-[var(--text-main)]">
                            {selectedSeller.pctMeta.toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden">
                            <div 
                            className={`h-full rounded-full transition-all duration-1000 ${selectedSeller.pctMeta >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(selectedSeller.pctMeta, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">{formatCurrency(selectedSeller.totalVendas)}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">Meta: {formatCurrency(selectedSeller.meta)}</span>
                        </div>
                        </div>

                        {/* Conversão */}
                        <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-medium text-[var(--text-soft)]">Taxa de Conversão</span>
                            <span className="text-xs font-bold text-[var(--text-main)]">
                            {selectedSeller.taxaConversao.toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden">
                            <div 
                            className="h-full rounded-full bg-cyan-500 transition-all duration-1000"
                            style={{ width: `${Math.min(selectedSeller.taxaConversao * 2, 100)}%` }} // Scale factor for visualization
                            />
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Baseado em {selectedSeller.totalOportunidades} oportunidades</p>
                        </div>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-6">
                        {/* Ligações Feitas */}
                        <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-medium text-[var(--text-soft)]">Ligações Realizadas</span>
                            <span className="text-xs font-bold text-[var(--text-main)]">
                            {selectedSeller.ligacoesFeitas} / 1000
                            </span>
                        </div>
                        <div className="w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden">
                            <div 
                            className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                            style={{ width: `${Math.min((selectedSeller.ligacoesFeitas / 1000) * 100, 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Meta ref: 1.000 ligações/mês</p>
                        </div>

                        {/* Taxa de Atendimento (Invertida) */}
                        <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-medium text-[var(--text-soft)]">Eficiência de Contato</span>
                            <span className="text-xs font-bold text-[var(--text-main)]">
                            {selectedSeller.ligacoesFeitas > 0 
                                ? ((1 - (selectedSeller.ligacoesNaoAtendidas / selectedSeller.ligacoesFeitas)) * 100).toFixed(1) 
                                : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-[var(--bg-panel)] h-2 rounded-full overflow-hidden">
                            <div 
                            className="h-full rounded-full bg-purple-500 transition-all duration-1000"
                            style={{ width: `${selectedSeller.ligacoesFeitas > 0 ? (1 - (selectedSeller.ligacoesNaoAtendidas / selectedSeller.ligacoesFeitas)) * 100 : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">Atendidas: {selectedSeller.ligacoesFeitas - selectedSeller.ligacoesNaoAtendidas}</span>
                            <span className="text-[10px] text-rose-400">Perdidas: {selectedSeller.ligacoesNaoAtendidas}</span>
                        </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Sales Table (Full Width) */}
              <div className="mt-8 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                 <h4 className="text-sm font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                    <Star size={16} className="text-yellow-400" />
                    Histórico de Vendas Recentes
                 </h4>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
                         <th className="py-3 px-4 font-semibold">Cliente</th>
                         <th className="py-3 px-4 font-semibold">Data</th>
                         <th className="py-3 px-4 font-semibold">Produto/Solução</th>
                         <th className="py-3 px-4 font-semibold text-right">Valor</th>
                         <th className="py-3 px-4 font-semibold text-center">Status</th>
                       </tr>
                     </thead>
                     <tbody className="text-sm">
                       {selectedSeller.historico.filter(op => isVenda(op.status)).map((op, idx) => (
                         <tr key={idx} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-panel)] transition-colors">
                           <td className="py-3 px-4 text-[var(--text-main)] font-medium">{op.cliente || 'N/A'}</td>
                           <td className="py-3 px-4 text-[var(--text-soft)]">{op.data_inclusao ? format(parseISO(op.data_inclusao), 'dd/MM/yyyy') : '-'}</td>
                           <td className="py-3 px-4 text-[var(--text-soft)]">{op.solucao || '-'}</td>
                           <td className="py-3 px-4 text-[var(--text-main)] font-bold text-right text-emerald-400">{op.valor_proposta}</td>
                           <td className="py-3 px-4 text-center">
                             <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                               VENDIDO
                             </span>
                           </td>
                         </tr>
                       ))}
                       {selectedSeller.historico.filter(op => isVenda(op.status)).length === 0 && (
                         <tr>
                           <td colSpan={5} className="py-8 text-center text-[var(--text-muted)] italic">
                             Nenhuma venda registrada neste período.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default Vendedores;
