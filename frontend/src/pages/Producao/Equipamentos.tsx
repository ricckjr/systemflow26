import React from 'react'
import { Wrench } from 'lucide-react'

const Equipamentos: React.FC = () => {
  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6">
      <div className="flex items-center gap-2 mb-4 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <Wrench size={14} />
        Equipamentos
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-sm text-[var(--text-muted)]">
        Módulo de equipamentos em preparação.
      </div>
    </div>
  )
}

export default Equipamentos

