import React from 'react'

type Props = {
  label: string
  value: any
  icon: any
  isHighlight?: boolean
}

const InfoBox: React.FC<Props> = ({ label, value, icon: Icon, isHighlight }) => (
  <div className={`p-6 rounded-[1.5rem] border flex items-center gap-5 transition-all group ${isHighlight ? 'bg-brand-600 border-brand-500 shadow-xl shadow-brand-600/20 scale-105 z-10' : 'bg-surface border-line'}`}>
    <div className={`p-4 rounded-xl transition-all ${isHighlight ? 'bg-white/20 text-white' : 'bg-background text-ink-700 group-hover:text-brand-600 dark:group-hover:text-brand-400'}`}>
      <Icon size={22} />
    </div>
    <div className="overflow-hidden">
      <p className={`text-[9px] font-black uppercase tracking-widest mb-1.5 leading-none ${isHighlight ? 'text-brand-100' : 'text-ink-700'}`}>{label}</p>
      <p className={`text-sm truncate leading-tight ${isHighlight ? 'text-white font-extrabold' : 'text-ink-900 font-bold'}`}>{value || '--'}</p>
    </div>
  </div>
)

export default InfoBox
