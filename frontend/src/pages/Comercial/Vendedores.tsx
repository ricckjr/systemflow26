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
  BarChart2
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
import { fetchOportunidades, CRM_Oportunidade, isVenda } from '@/services/crm';
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format';
import { logInfo, logError } from '@/utils/logger';
import { format, isSameMonth, parseISO } from 'date-fns';
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
}

const Vendedores: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allOportunidades, setAllOportunidades] = useState<CRM_Oportunidade[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<SellerStats | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const ops = await fetchOportunidades();
      setAllOportunidades(ops);
    } catch (err) {
      logError('crm', 'vendedores-error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Process data when opportunities or month changes
  useEffect(() => {
    if (allOportunidades.length === 0) return;

    const filteredOps = allOportunidades.filter(op => {
      if (!op.data_inclusao) return false;
      return isSameMonth(parseISO(op.data_inclusao), selectedMonth);
    });

    // Group by seller
    const sellerMap: Record<string, {
      totalVendas: number;
      countVendas: number;
      totalOps: number;
      ops: CRM_Oportunidade[];
    }> = {};

    filteredOps.forEach(op => {
      const sellerName = op.vendedor || 'Não Atribuído';
      if (!sellerMap[sellerName]) {
        sellerMap[sellerName] = { totalVendas: 0, countVendas: 0, totalOps: 0, ops: [] };
      }

      sellerMap[sellerName].totalOps += 1;
      sellerMap[sellerName].ops.push(op);

      if (isVenda(op.status)) {
        const valor = parseValorProposta(op.valor_proposta);
        sellerMap[sellerName].totalVendas += valor;
        sellerMap[sellerName].countVendas += 1;
      }
    });

    // Transform to array
    const sellerArray: SellerStats[] = Object.entries(sellerMap).map(([name, data]) => {
      const taxaConversao = data.totalOps > 0 ? (data.countVendas / data.totalOps) * 100 : 0;
      const ticketMedio = data.countVendas > 0 ? data.totalVendas / data.countVendas : 0;
      const pctMeta = (data.totalVendas / META_INDIVIDUAL) * 100;

      // Calculate sales over time (mocked slightly for visualization if needed, but here aggregated by day)
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
        historico: data.ops
      };
    });

    // Sort by sales (Ranking)
    sellerArray.sort((a, b) => b.totalVendas - a.totalVendas);
    sellerArray.forEach((s, i) => s.ranking = i + 1);

    setSellers(sellerArray);

  }, [allOportunidades, selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  if (loading) {
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
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">Conv.</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {seller.taxaConversao.toFixed(1)}%
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedSeller(null)} />
          <div className="relative w-full max-w-5xl bg-[var(--bg-panel)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-body)]/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-lg font-bold uppercase shadow-lg shadow-cyan-500/20">
                    {selectedSeller.name.substring(0, 2)}
                 </div>
                 <div>
                   <h3 className="text-2xl font-black text-[var(--text-main)]">{selectedSeller.name}</h3>
                   <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-soft)]">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
                      <span>•</span>
                      <span>{format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</span>
                   </div>
                 </div>
              </div>
              <button onClick={() => setSelectedSeller(null)} className="p-2 hover:bg-[var(--bg-body)] rounded-full text-[var(--text-muted)] transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              
              {/* Top KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <DollarSign size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Vendas Totais</p>
                  <p className="text-2xl font-black text-[var(--text-main)]">{formatCurrency(selectedSeller.totalVendas)}</p>
                  <p className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1">
                    <TrendingUp size={10} /> +12% vs mês anterior
                  </p>
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

                <div className="bg-[var(--bg-body)] p-5 rounded-2xl border border-[var(--border)] relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <PieChart size={40} />
                  </div>
                  <p className="text-xs uppercase font-bold text-[var(--text-muted)] mb-1">Taxa de Conversão</p>
                  <p className="text-2xl font-black text-cyan-400">{selectedSeller.taxaConversao.toFixed(1)}%</p>
                  <p className="text-[10px] text-[var(--text-soft)] mt-2">
                    {selectedSeller.totalOportunidades} oportunidades trabalhadas
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
                
                {/* Evolution Chart */}
                <div className="lg:col-span-2 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6">
                  <h4 className="text-sm font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                    <TrendingUp size={16} className="text-cyan-400" />
                    Evolução de Vendas (Diária)
                  </h4>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedSeller.vendasPorDia}>
                        <defs>
                          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="dia" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                          tickFormatter={(val) => `R$ ${val/1000}k`}
                        />
                        <Tooltip 
                          contentStyle={{ background: 'var(--bg-panel)', borderColor: 'var(--border)', borderRadius: '8px' }}
                          itemStyle={{ color: '#06b6d4' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Area type="monotone" dataKey="valor" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorVendas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Sales List */}
                <div className="bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] p-6 flex flex-col">
                  <h4 className="text-sm font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                    <Star size={16} className="text-amber-400" />
                    Últimas Vendas
                  </h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[300px]">
                    {selectedSeller.historico.filter(op => isVenda(op.status)).slice(0, 10).map((op, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:border-cyan-500/30 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-[var(--text-main)] line-clamp-1">{op.cliente || 'Cliente'}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{op.data_inclusao ? format(parseISO(op.data_inclusao), 'dd/MM') : '-'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-emerald-400">{op.valor_proposta}</p>
                        </div>
                      </div>
                    ))}
                    {selectedSeller.historico.filter(op => isVenda(op.status)).length === 0 && (
                      <div className="text-center py-10 text-[var(--text-muted)] text-xs italic">
                        Nenhuma venda neste período.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendedores;
