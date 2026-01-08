import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Profile } from '../../types'
import {
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Search,
  ShieldCheck,
  Key,
  Edit2,
} from 'lucide-react'
import { useScrollLock } from '../../hooks/useScrollLock'
import { fetchProfiles } from '../../services/profiles'
import { useAuth } from '../../src/contexts/AuthContext'

interface UsuariosProps {
  profile?: Profile
}

export default function Usuarios({ profile: propProfile }: UsuariosProps) {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return <div className="p-8 text-center text-white">Carregando perfil...</div>;

  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useScrollLock(isModalOpen)

  const isAdmin = profile.role === 'admin'

  // ============================
  // Load users
  // ============================
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const items = await fetchProfiles()
        if (alive) setUsuarios(items)
      } catch {
        if (alive) setError('Erro ao carregar usuários')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  // ============================
  // Toggle status
  // ============================
  const toggleStatus = async (user: Profile) => {
    if (!isAdmin) return alert('Apenas administradores')
    if (user.id === profile.id) return alert('Você não pode se desativar')

    try {
      await supabase.from('profiles').update({ ativo: !user.ativo }).eq('id', user.id)
      setUsuarios(prev =>
        prev.map(u => (u.id === user.id ? { ...u, ativo: !u.ativo } : u))
      )
    } catch {
      alert('Erro ao alterar status')
    }
  }

  const filteredUsers = useMemo(() => {
    const s = debouncedSearch.toLowerCase()
    return usuarios.filter(
      u =>
        u.nome.toLowerCase().includes(s) ||
        u.email_login.toLowerCase().includes(s)
    )
  }, [usuarios, debouncedSearch])

  // ============================
  // Render
  // ============================
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-white">Usuários</h2>

        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20"
          >
            <UserPlus size={20} />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="bg-industrial-surface rounded-2xl border border-industrial-border overflow-hidden">
        <div className="p-4 border-b border-industrial-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-industrial-text-secondary" size={18} />
            <input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 input"
            />
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-industrial-bg/50 text-industrial-text-secondary text-xs uppercase">
            <tr>
              <th className="px-6 py-4 text-left">Usuário</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Função</th>
              <th className="px-6 py-4">Criado</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-industrial-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-industrial-text-secondary">
                  Carregando...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-industrial-text-secondary">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-industrial-bg/40">
                  <td className="px-6 py-4">
                    <p className="text-white font-bold">{user.nome}</p>
                    <p className="text-xs text-industrial-text-secondary">{user.email_login}</p>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        user.ativo
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {user.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                      <div className="flex items-center gap-1.5 text-white">
                        <ShieldCheck size={16} className="text-brand-500" />
                        Administrador
                      </div>
                    ) : (
                      <span className="text-industrial-text-secondary">Usuário</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-industrial-text-secondary">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleStatus(user)}
                        className={`p-2 rounded-lg ${
                          user.ativo
                            ? 'text-rose-500 hover:bg-rose-500/10'
                            : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                        title={user.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {user.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>

                      <button
                        className="p-2 text-industrial-text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded-lg"
                        title="Resetar senha (via n8n)"
                      >
                        <Key size={18} />
                      </button>

                      <button
                        className="p-2 text-industrial-text-secondary hover:text-brand-500 hover:bg-brand-500/10 rounded-lg"
                        title="Editar permissões"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal placeholder */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" onClick={() => setIsModalOpen(false)}>
          <div className="bg-industrial-surface p-6 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-3">Criar novo usuário</h3>
            <p className="text-industrial-text-secondary text-sm">
              A criação real de usuários deve ser feita via n8n / Edge Functions usando Service Role.
            </p>
            <div className="flex justify-end mt-6">
              <button onClick={() => setIsModalOpen(false)} className="btn-primary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
