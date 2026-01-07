
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Star, Target, Users } from 'lucide-react';

const rankingData = [
  { name: 'Heinrik', vendas: 120, meta: 100, cor: '#4f46e5' },
  { name: 'Amanda', vendas: 95, meta: 100, cor: '#6366f1' },
  { name: 'Carlos', vendas: 110, meta: 100, cor: '#818cf8' },
  { name: 'Julia', vendas: 75, meta: 100, cor: '#a5b4fc' },
  { name: 'Ricardo', vendas: 130, meta: 100, cor: '#4338ca' },
];

const SellerPerformance: React.FC = () => {
  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-industrial-text-primary tracking-tight uppercase">Performance da Equipe</h2>
        <p className="text-xs text-industrial-text-secondary font-bold uppercase tracking-widest mt-1">Monitoramento individual e ranking de vendas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Top Performer Card */}
        <div className="lg:col-span-1 bg-brand-600 dark:bg-brand-500/20 rounded-3xl p-6 text-white shadow-2xl shadow-brand-600/20 relative overflow-hidden group">
          <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
          <h3 className="font-black text-brand-100 mb-6 flex items-center gap-2 uppercase tracking-[0.2em] text-[10px]">
            Vendedor do Mês
          </h3>
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black border border-white/20 shadow-inner">
              R
            </div>
            <div>
              <p className="text-xl font-black leading-tight">Ricardo Alvez</p>
              <p className="text-brand-200 text-xs font-bold uppercase tracking-widest mt-1">Comercial Sênior</p>
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            <div className="flex justify-between items-center bg-white/10 rounded-2xl p-4 border border-white/10">
              <span className="text-xs font-black uppercase tracking-widest opacity-80">Vendas</span>
              <span className="font-black text-xl">130</span>
            </div>
            <div className="flex justify-between items-center bg-white/10 rounded-2xl p-4 border border-white/10">
              <span className="text-xs font-black uppercase tracking-widest opacity-80">Conversão</span>
              <span className="font-black text-xl">24.5%</span>
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="Média de Satisfação" value="4.9 / 5.0" icon={Star} color="yellow" />
          <StatCard label="Meta Global" value="92% Atingida" icon={Target} color="green" />
          <StatCard label="Atendimentos Hoje" value="248" icon={Users} color="blue" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 md:p-8 overflow-hidden">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-10">Ranking de Conversão (Vendas x Meta)</h3>
        <div className="h-[400px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingData} layout="vertical" margin={{ left: -10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800/50" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                // Removed invalid textTransform property from SVG tick object to fix TypeScript error
                tick={{fill: '#64748b', fontSize: 10, fontWeight: 900}} 
              />
              <Tooltip 
                cursor={{fill: '#f8fafc', opacity: 0.1}}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px', background: '#0f172a', color: '#fff' }}
                itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
              />
              <Bar dataKey="vendas" radius={[0, 12, 12, 0]} barSize={24}>
                {rankingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string, icon: any, color: string }> = ({ label, value, icon: Icon, color }) => {
  const colors: any = {
    yellow: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:scale-105 transition-transform duration-500">
      <div className={`w-14 h-14 ${colors[color]} rounded-2xl flex items-center justify-center mb-6 shadow-sm`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  );
};

export default SellerPerformance;
