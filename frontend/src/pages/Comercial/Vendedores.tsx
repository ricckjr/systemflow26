import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Trophy, Star, Target, Users, RefreshCw } from 'lucide-react';
import { fetchOportunidades, CRM_Oportunidade, isVenda } from '@/services/crm';
import { parseValorProposta, formatCurrency } from '@/utils/comercial/format';
import { logInfo, logError } from '@/utils/logger';

// Meta mensal fictícia (pode ser ajustada ou movida para config)
const META_INDIVIDUAL = 50000; // R$ 50.000,00

interface RankingItem {
  name: string;
  vendas: number;
  meta: number;
  cor: string;
}

const SellerPerformance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [stats, setStats] = useState({
    satisfacao: '4.9 / 5.0', // Placeholder
    metaGlobal: '0%',
    atendimentos: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const ops = await fetchOportunidades();
      logInfo('crm', 'vendedores-load', { count: ops.length });
      processData(ops);
    } catch (err) {
      logError('crm', 'vendedores-error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const processData = (ops: CRM_Oportunidade[]) => {
    // Agrupar por vendedor
    const porVendedor: Record<string, number> = {};
    let totalVendasGeral = 0;
    let countAtendimentos = ops.length; // Total de oportunidades = atendimentos

    ops.forEach(op => {
      const vendedor = op.vendedor || 'Não atribuído';
      const valor = parseValorProposta(op.valor_proposta);
      
      // Se for venda confirmada, soma ao vendedor
      if (isVenda(op.status)) {
        porVendedor[vendedor] = (porVendedor[vendedor] || 0) + valor;
        totalVendasGeral += valor;
      }
    });

    // Transformar em array para o gráfico
    const data: RankingItem[] = Object.entries(porVendedor).map(([name, total]) => ({
      name,
      vendas: total,
      meta: META_INDIVIDUAL,
      cor: 'var(--primary)', // Cor base
    }));

    // Ordenar por vendas (maior para menor)
    data.sort((a, b) => b.vendas - a.vendas);

    // Atribuir cores baseadas no ranking
    data.forEach((item, index) => {
      if (index === 0) item.cor = 'var(--primary-700)'; // Ouro/Top 1
      else if (index === 1) item.cor = 'var(--primary-600)';
      else if (index === 2) item.cor = 'var(--primary)';
      else item.cor = 'rgba(56,189,248,0.4)';
    });

    setRankingData(data);

    // Calcular meta global
    const totalMeta = data.length * META_INDIVIDUAL;
    const pctMeta = totalMeta > 0 ? (totalVendasGeral / totalMeta) * 100 : 0;

    setStats(prev => ({
      ...prev,
      metaGlobal: `${pctMeta.toFixed(1)}% atingida`,
      atendimentos: countAtendimentos
    }));
  };

  const topSeller = rankingData.length > 0 ? rankingData[0] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--primary)]">
        <RefreshCw className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[18px] font-semibold tracking-wide text-[var(--text-main)]">
            Performance da Equipe
          </h2>
          <p className="text-[11px] uppercase tracking-widest font-medium text-[var(--text-soft)] mt-1">
            Ranking e indicadores de vendas (Baseado em CRM)
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-lg border border-[var(--border)] hover:bg-white/5 transition"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* TOP SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* TOP SELLER */}
        <div className="lg:col-span-1 card-panel p-6 relative overflow-hidden">
          <Trophy
            className="absolute -right-6 -bottom-6 w-24 h-24 text-[var(--primary)]/10"
          />

          <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-soft)] mb-4">
            Vendedor do mês
          </p>

          {topSeller ? (
            <>
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-14 h-14 rounded-xl bg-[var(--primary-soft)]
                                border border-[var(--primary)]/20
                                flex items-center justify-center
                                text-[var(--primary)] font-bold text-xl">
                  {topSeller.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text-main)] leading-tight truncate max-w-[120px]">
                    {topSeller.name}
                  </p>
                  <p className="text-[11px] text-[var(--text-soft)] mt-1">
                    Campeão de Vendas
                  </p>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center
                                bg-white/5 border border-[var(--border)]
                                rounded-xl px-4 py-3">
                  <span className="text-[11px] uppercase tracking-widest text-[var(--text-soft)]">
                    Vendas
                  </span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {formatCurrency(topSeller.vendas)}
                  </span>
                </div>

                <div className="flex justify-between items-center
                                bg-white/5 border border-[var(--border)]
                                rounded-xl px-4 py-3">
                  <span className="text-[11px] uppercase tracking-widest text-[var(--text-soft)]">
                    Meta
                  </span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {((topSeller.vendas / topSeller.meta) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--text-soft)]">Nenhuma venda registrada este mês.</div>
          )}
        </div>

        {/* STATS */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            label="Média de satisfação"
            value={stats.satisfacao}
            icon={Star}
            tone="warning"
          />
          <StatCard
            label="Meta global"
            value={stats.metaGlobal}
            icon={Target}
            tone="success"
          />
          <StatCard
            label="Oportunidades (Total)"
            value={String(stats.atendimentos)}
            icon={Users}
            tone="info"
          />
        </div>
      </div>

      {/* CHART */}
      <div className="card-panel p-6">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold
                       text-[var(--text-soft)] mb-6">
          Ranking de Vendas (Realizado vs Meta de {formatCurrency(META_INDIVIDUAL)})
        </h3>

        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rankingData}
              layout="vertical"
              margin={{ left: 0, right: 24 }}
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="rgba(255,255,255,0.04)"
              />

              <XAxis type="number" hide />

              <YAxis
                type="category"
                dataKey="name"
                width={100}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--text-soft)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />

              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                }}
                formatter={(value: number) => formatCurrency(value)}
                itemStyle={{
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              />

              <Bar dataKey="vendas" barSize={22} radius={[0, 10, 10, 0]}>
                {rankingData.map((entry, index) => (
                  <Cell key={index} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/* ===========================
   STAT CARD
=========================== */
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ElementType;
  tone: 'success' | 'warning' | 'info';
}> = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    success: 'bg-emerald-500/10 text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-400',
    info: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="card-panel p-6 flex flex-col justify-between">
      <div
        className={`w-12 h-12 rounded-xl
                    ${tones[tone]}
                    flex items-center justify-center mb-4`}
      >
        <Icon size={20} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-widest
                      text-[var(--text-soft)] mb-1">
          {label}
        </p>
        <p className="text-[18px] font-semibold text-[var(--text-main)]">
          {value}
        </p>
      </div>
    </div>
  );
};

export default SellerPerformance;
