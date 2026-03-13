import React from 'react'
import { Wallet, FileText } from 'lucide-react'

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-5">{children}</div>
)

export default function ContaReceber() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-main)]">Conta a Receber</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Gestão de títulos e recebimentos.</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-soft)]">
          <Wallet size={14} className="text-[var(--primary)]" />
          Financeiro
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center">
            <FileText size={18} className="text-[var(--primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-soft)]">Em breve</p>
            <p className="text-sm text-[var(--text-muted)]">Aqui você vai gerenciar contas a receber, cobranças e status.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

