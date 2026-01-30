import React from 'react'
import PermissoesRbac from '@/pages/Configuracoes/PermissoesRbac'

export default function PermissoesPage() {
  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-white">Permissões</h1>
        <p className="text-sm text-industrial-text-secondary">Controle de acessos por perfil e módulo</p>
      </div>
      <PermissoesRbac />
    </div>
  )
}
