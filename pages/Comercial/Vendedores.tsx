import React from 'react';
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
import { Trophy, Star, Target, Users } from 'lucide-react';

/* ===========================
   MOCK DATA (INALTERADO)
=========================== */
const rankingData = [
  { name: 'Heinrik', vendas: 120, meta: 100, cor: 'var(--primary-700)' },
  { name: 'Amanda', vendas: 95, meta: 100, cor: 'var(--primary-600)' },
  { name: 'Carlos', vendas: 110, meta: 100, cor: 'var(--primary)' },
  { name: 'Julia', vendas: 75, meta: 100, cor: 'rgba(56,189,248,0.4)' },
  { name: 'Ricardo', vendas: 130, meta: 100, cor: 'var(--primary)' },
];

const SellerPerformance: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h2 className="text-[18px] font-semibold tracking-wide text-[var(--text-main)]">
          Performance da Equipe
        </h2>
        <p className="text-[11px] uppercase tracking-widest font-medium text-[var(--text-soft)] mt-1">
          Ranking e indicadores de vendas
        </p>
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

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-14 h-14 rounded-xl bg-[var(--primary-soft)]
                            border border-[var(--primary)]/20
                            flex items-center justify-center
                            text-[var(--primary)] font-bold text-xl">
              R
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[var(--text-main)] leading-tight">
                Ricardo Alvez
              </p>
              <p className="text-[11px] text-[var(--text-soft)] mt-1">
                Comercial Sênior
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
                130
              </span>
            </div>

            <div className="flex justify-between items-center
                            bg-white/5 border border-[var(--border)]
                            rounded-xl px-4 py-3">
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-soft)]">
                Conversão
              </span>
              <span className="font-semibold text-[var(--text-main)]">
                24,5%
              </span>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            label="Média de satisfação"
            value="4.9 / 5.0"
            icon={Star}
            tone="warning"
          />
          <StatCard
            label="Meta global"
            value="92% atingida"
            icon={Target}
            tone="success"
          />
          <StatCard
            label="Atendimentos hoje"
            value="248"
            icon={Users}
            tone="info"
          />
        </div>
      </div>

      {/* CHART */}
      <div className="card-panel p-6">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold
                       text-[var(--text-soft)] mb-6">
          Ranking de conversão (vendas × meta)
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
