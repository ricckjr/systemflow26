import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Profile, Cargo } from '../../types'
import { CARGO_OPTIONS } from '../../src/constants/cargo'
import {
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Search,
  ShieldCheck,
  Key,
  Edit2,
  AlertTriangle,
  Loader2,
  X
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

  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
      email: '',
      password: '',
      nome: '',
      cargo: 'VENDEDOR' as Cargo,
      ativo: true
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useScrollLock(isModalOpen)

  const isAdmin = profile?.cargo === 'ADMIN'

  // Load users
  const loadUsers = async () => {
    try {
        setLoading(true)
        const items = await fetchProfiles()
        setUsuarios(items)
    } catch (err) {
        setError('Erro ao carregar usuários')
    } finally {
        setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Filter
  const filteredUsers = useMemo(() => {
    const s = debouncedSearch.toLowerCase()
    return usuarios.filter(
      u =>
        u.nome.toLowerCase().includes(s) ||
        u.email_login.toLowerCase().includes(s)
    )
  }, [usuarios, debouncedSearch])

  // Actions
  const handleOpenCreate = () => {
      setEditingUser(null)
      setFormData({
          email: '',
          password: '',
          nome: '',
          cargo: 'VENDEDOR',
          ativo: true
      })
      setFormError(null)
      setIsModalOpen(true)
  }

  const handleOpenEdit = (user: Profile) => {
      setEditingUser(user)
      setFormData({
          email: user.email_login,
          password: '', 
          nome: user.nome,
          cargo: user.cargo || 'VENDEDOR',
          ativo: user.ativo
      })
      setFormError(null)
      setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)
      setFormLoading(true)

      try {
          if (editingUser) {
              // Edit Mode: Update Profile only
            const { error } = await (supabase.from('profiles') as any)
                .update({
                    cargo: formData.cargo,
                    ativo: formData.ativo
                })
                .eq('id', editingUser.id)

              if (error) throw error
              
              // Optimistic update
              setUsuarios(prev => prev.map(u => u.id === editingUser.id ? { ...u, cargo: formData.cargo, ativo: formData.ativo } : u))
              setIsModalOpen(false)
          } else {
              // Create Mode: Call Edge Function
              if (formData.password.length < 6) {
                  throw new Error('A senha deve ter no mínimo 6 caracteres')
              }
              
              // Calling 'admin-create-user' which should handle auth + sync-profile
              const { data, error } = await supabase.functions.invoke('admin-create-user', {
                  body: {
                      email: formData.email,
                      password: formData.password,
                      nome: formData.nome,
                      cargo: formData.cargo
                  }
              })

              if (error) throw new Error(error.message || 'Erro ao chamar função de criação')
              if (data?.error) throw new Error(data.error)

              // Refresh list
              await loadUsers()
              setIsModalOpen(false)
          }
      } catch (err: any) {
          console.error(err)
          setFormError(err.message || 'Ocorreu um erro ao salvar')
      } finally {
          setFormLoading(false)
      }
  }

  const toggleStatus = async (user: Profile) => {
    if (!isAdmin) return
    if (user.id === profile?.id) {
        setError('Você não pode desativar seu próprio usuário.')
        setTimeout(() => setError(null), 3000)
        return
    }

    const newStatus = !user.ativo
    try {
        const { error } = await (supabase.from('profiles') as any).update({ ativo: newStatus }).eq('id', user.id)
        if (error) throw error
        setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, ativo: newStatus } : u))
    } catch (err) {
        setError('Erro ao atualizar status do usuário.')
        setTimeout(() => setError(null), 3000)
    }
  }

  if (!profile) return <div className="p-8 text-center text-white">Carregando perfil...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-white">Usuários</h2>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20"
          >
            <UserPlus size={20} />
            Novo Usuário
          </button>
        )}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg z-50 animate-in slide-in-from-bottom-5">
            <AlertTriangle size={20} />
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:text-white"><X size={16} /></button>
        </div>
      )}

      <div className="bg-industrial-surface rounded-2xl border border-industrial-border overflow-hidden">
        <div className="p-4 border-b border-industrial-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-industrial-text-secondary" size={18} />
            <input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 input w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-industrial-bg/50 text-industrial-text-secondary text-xs uppercase">
            <tr>
              <th className="px-6 py-4 text-left">Usuário</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Cargo</th>
              <th className="px-6 py-4">Criado</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-industrial-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-industrial-text-secondary">
                  <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
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
                <tr key={user.id} className="hover:bg-industrial-bg/40 transition-colors">
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
                     <span className="text-white font-medium bg-industrial-bg px-2 py-1 rounded border border-industrial-border">
                         {user.cargo || 'N/A'}
                     </span>
                  </td>

                  <td className="px-6 py-4 text-industrial-text-secondary">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleStatus(user)}
                        disabled={!isAdmin || user.id === profile.id}
                        className={`p-2 rounded-lg transition-colors ${
                          user.ativo
                            ? 'text-rose-500 hover:bg-rose-500/10'
                            : 'text-emerald-500 hover:bg-emerald-500/10'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={user.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {user.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>

                      <button
                        className="p-2 text-industrial-text-secondary hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Resetar senha"
                      >
                        <Key size={18} />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(user)}
                        disabled={!isAdmin}
                        className="p-2 text-industrial-text-secondary hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Editar"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-industrial-surface p-6 rounded-xl w-full max-w-md border border-industrial-border" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            
            {formError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle size={16} />
                    {formError}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {!editingUser && (
                    <>
                        <div>
                            <label className="block text-sm text-industrial-text-secondary mb-1">Nome</label>
                            <input 
                                required
                                className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none"
                                value={formData.nome}
                                onChange={e => setFormData({...formData, nome: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-industrial-text-secondary mb-1">Email</label>
                            <input 
                                type="email"
                                required
                                className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-industrial-text-secondary mb-1">Senha</label>
                            <input 
                                type="password"
                                required
                                className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                        </div>
                    </>
                )}
                
                {editingUser && (
                     <div>
                        <label className="block text-sm text-industrial-text-secondary mb-1">Usuário</label>
                        <div className="text-white font-medium">{formData.nome}</div>
                        <div className="text-xs text-industrial-text-secondary">{formData.email}</div>
                     </div>
                )}

                <div>
                    <label className="block text-sm text-industrial-text-secondary mb-1">Cargo</label>
                    <select 
                        className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-white focus:border-brand-500 outline-none"
                        value={formData.cargo}
                        onChange={e => setFormData({...formData, cargo: e.target.value as Cargo})}
                    >
                        {CARGO_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>

                {editingUser && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-industrial-text-secondary">Ativo</label>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : 'bg-gray-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-industrial-text-secondary hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        disabled={formLoading}
                        className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {formLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                        {formLoading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
