import React from 'react'
import { Box } from 'lucide-react'

const VisaoGeral: React.FC = () => {
  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6">
      <div className="flex items-center gap-2 mb-4 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <Box size={14} />
        Compras e Estoque
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--text)]">Compras e Estoque</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Área em construção. Em breve: pedidos, entradas, saídas e inventário.
          </p>
        </div>
      </div>
    </div>
  )
}

export default VisaoGeral
