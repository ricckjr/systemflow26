import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Usuarios from '@/pages/Configuracoes/Usuarios'

export default function UsuariosPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const tab = (params.get('tab') || '').toLowerCase()
    if (tab === 'permissoes') {
      navigate('/app/configuracoes/permissoes', { replace: true })
    }
  }, [navigate, params])

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-white">Usuários</h1>
        <p className="text-sm text-industrial-text-secondary">Gerencie acessos e perfis</p>
      </div>
      <Usuarios />
    </div>
  )
}
