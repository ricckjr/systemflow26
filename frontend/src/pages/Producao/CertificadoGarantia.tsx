import React from 'react'
import { BadgeCheck, FileText } from 'lucide-react'

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-5">
    {children}
  </div>
)

export default function CertificadoGarantia() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-main)]">Certificado garantia</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Consulta e gestão de certificados e garantias.
          </p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-soft)]">
          <BadgeCheck size={14} className="text-[var(--primary)]" />
          Produção
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-center">
            <FileText size={18} className="text-[var(--primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-soft)]">Em breve</p>
            <p className="text-sm text-[var(--text-muted)]">
              Aqui vamos listar certificados e garantias vinculados às ordens de serviço.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
