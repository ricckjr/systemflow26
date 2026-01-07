import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type Props = {
  label: string
  value: string
  count?: number
  trend: number
  color: 'emerald' | 'indigo' | 'rose' | 'amber' | 'slate' | 'brand'
  icon: any
  isInverse?: boolean
}

const TrendCard: React.FC<Props> = ({ label, value, count, trend, color, icon: Icon, isInverse }) => {
  const isUp = trend >= 0
  const isNeutral = trend === 0
  const isPositive = isInverse ? !isUp : isUp

  const colors: any = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    indigo: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    slate: 'text-ink-700 dark:text-ink-300 bg-gray-100 dark:bg-white/5',
    brand: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
  }

  return (
    <div className="bg-surface p-6 rounded-[1.5rem] border border-line shadow-sm flex flex-col justify-between group hover:scale-[1.03] transition-all cursor-default h-full min-h-[140px] duration-300">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colors[color]} group-hover:scale-110 transition-transform`}>
            <Icon size={18} />
          </div>
          {!isNeutral && (
            <div className={`flex items-center gap-1 text-[9px] font-black ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-extrabold text-ink-900 tracking-tighter leading-none">{value}</p>
          {count !== undefined && (
            <p className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest">{count} <span className="text-[8px] opacity-60 text-ink-700">Negócios</span></p>
          )}
          <p className="text-[9px] font-bold text-ink-700 uppercase tracking-widest pt-1">{label}</p>
        </div>
      </div>
    </div>
  )
}

export default TrendCard
