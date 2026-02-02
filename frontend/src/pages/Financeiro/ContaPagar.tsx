import React from 'react'
import { Wallet, FileText } from 'lucide-react'

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-5 shadow-sm">{children}</div>
)

export default function ContaPagar() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Conta a Pagar</h1>
          <p className="text-sm text-slate-400 mt-1">Gestão de pagamentos e obrigações.</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300">
          <Wallet size={14} className="text-cyan-400" />
          Financeiro
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FileText size={18} className="text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200">Em breve</p>
            <p className="text-sm text-slate-400">Aqui você vai gerenciar contas a pagar, vencimentos e status.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

