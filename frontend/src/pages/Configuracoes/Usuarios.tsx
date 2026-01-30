import React, { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Profile } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useScrollLock } from '@/hooks/useScrollLock'
import { HorizontalScrollArea } from '@/components/ui'
import {
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Search,
  Key,
  Edit2,
  AlertTriangle,
  Loader2,
  X,
  Phone,
  Mail,
  Building,
  User,
  Hash
} from 'lucide-react'

// Helper de máscara para telefone (BR)
const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d)(\d{4})$/, '$1-$2')
}

interface UsuariosProps {
  profile?: Profile
}

type Perfil = {
  perfil_id: string
  perfil_nome: string
  perfil_descricao?: string | null
}

export default function Usuarios({ profile: propProfile }: UsuariosProps) {
  const { profile: authProfile, authReady, profileReady, isAdmin } = useAuth()
  const profile = propProfile || authProfile
  const authLoading = !authReady || !profileReady

  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
      nome: '',
      email_login: '',
      email_corporativo: '',
      telefone: '',
      ramal: '',
      senha: '',
      perfil_id: '',
      ativo: true
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useScrollLock(isModalOpen)

  const getPerfilNomeById = (perfilId: string) => perfis.find(p => p.perfil_id === perfilId)?.perfil_nome

  const perfilToCargo = (perfilNome?: string | null) => {
    const nome = (perfilNome || '').trim().toUpperCase()
    if (nome === 'ADMIN' || nome === 'ADMINISTRADOR') return 'ADMIN'
    if (nome === 'FINANCEIRO') return 'FINANCEIRO'
    if (nome === 'COMERCIAL' || nome === 'VENDEDOR') return 'COMERCIAL'
    if (nome === 'ADMINISTRATIVO') return 'ADMINISTRATIVO'
    if (nome === 'LOGISTICA') return 'LOGISTICA'
    if (nome === 'ELETRONICA') return 'ELETRONICA'
    if (nome === 'LABORATORIO' || nome === 'LABORATÓRIO') return 'LABORATORIO'
    if (nome === 'OFICINA' || nome === 'PRODUCAO') return 'OFICINA'
    return 'COMERCIAL'
  }

  const loadPerfis = async () => {
    try {
      const { perfis: data } = await api.rbac.listPerfis()
      setPerfis(data || [])
    } catch {
      setPerfis([])
    }
  }

  // Load users
  const loadUsers = async () => {
    try {
        setLoading(true)
        // Usando a nova API do backend
        const response = await api.users.list(1, 100, debouncedSearch) // Pegando 100 por enquanto
        setUsuarios(response.users)
    } catch (err: any) {
        console.error(err)
        setError('Erro ao carregar usuários: ' + (err.message || 'Erro desconhecido'))
    } finally {
        setLoading(false)
    }
  }

  useEffect(() => {
    loadPerfis()
    loadUsers()
  }, [debouncedSearch]) // Recarrega quando a busca muda (debounced)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 500)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Actions
  const handleOpenCreate = () => {
      const defaultPerfilId =
        perfis.find(p => p.perfil_nome === 'COMERCIAL')?.perfil_id ||
        perfis.find(p => p.perfil_nome === 'VENDEDOR')?.perfil_id ||
        perfis[0]?.perfil_id ||
        ''
      setEditingUser(null)
      setFormData({
          nome: '',
          email_login: '',
          email_corporativo: '',
          telefone: '',
          ramal: '',
          senha: '',
          perfil_id: defaultPerfilId,
          ativo: true
      })
      setFormError(null)
      setIsModalOpen(true)
  }

  const handleOpenEdit = (user: Profile) => {
      const currentPerfilId =
        (user as any)?.rbac_perfil?.perfil_id ||
        perfis.find(p => p.perfil_nome === 'COMERCIAL')?.perfil_id ||
        perfis.find(p => p.perfil_nome === 'VENDEDOR')?.perfil_id ||
        perfis[0]?.perfil_id ||
        ''
      setEditingUser(user)
      setFormData({
          nome: user.nome,
          email_login: user.email_login || '',
          email_corporativo: user.email_corporativo || '',
          telefone: user.telefone || '',
          ramal: user.ramal || '',
          senha: '', // Senha vazia na edição (só preenche se quiser alterar)
          perfil_id: currentPerfilId,
          ativo: user.ativo
      })
      setFormError(null)
      setIsModalOpen(true)
  }

  const validateForm = () => {
    if (!formData.nome.trim()) return 'Nome é obrigatório'
    if (!formData.email_login.trim()) return 'Email de login é obrigatório'
    if (!formData.email_login.includes('@')) return 'Email de login inválido'
    
    // Na criação, senha é obrigatória. Na edição, é opcional.
    if (!editingUser && !formData.senha) return 'Senha é obrigatória'
    if (formData.senha && formData.senha.length < 6) return 'A senha deve ter no mínimo 6 caracteres'
    
    // Validação de email corporativo se preenchido
    if (formData.email_corporativo && !formData.email_corporativo.includes('@')) return 'Email corporativo inválido'

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      const validationError = validateForm()
      if (validationError) {
          setFormError(validationError)
          return
      }

      setFormError(null)
      setFormLoading(true)

      try {
          const perfilNome = getPerfilNomeById(formData.perfil_id)
          const cargo = perfilToCargo(perfilNome)

          if (editingUser) {
              // Edit Mode
              await api.users.update(editingUser.id, {
                  ...formData,
                  cargo,
                  senha: formData.senha || undefined // Só envia se tiver valor
              })

              if (formData.perfil_id) {
                await api.rbac.assignUserPerfil(editingUser.id, formData.perfil_id)
              }
          } else {
              // Create Mode
              const resp = await api.users.create({ ...formData, cargo })
              const userId = resp?.user?.id
              if (userId && formData.perfil_id) {
                await api.rbac.assignUserPerfil(userId, formData.perfil_id)
              }
          }

          // Refresh list
          await loadUsers()
          setIsModalOpen(false)
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

    try {
        if (user.ativo) {
            await api.users.disable(user.id)
        } else {
            await api.users.enable(user.id)
        }
        // Optimistic update ou reload
        setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, ativo: !u.ativo } : u))
    } catch (err: any) {
        setError(err.message || 'Erro ao atualizar status.')
        setTimeout(() => setError(null), 3000)
    }
  }

  const handleDelete = async (user: Profile) => {
      if (!confirm(`Tem certeza que deseja excluir o usuário ${user.nome}? Essa ação não pode ser desfeita.`)) return

      try {
          await api.users.delete(user.id)
          setUsuarios(prev => prev.filter(u => u.id !== user.id))
      } catch (err: any) {
          setError(err.message || 'Erro ao excluir usuário')
      }
  }

  if (authLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-industrial-text-secondary">
            <Loader2 className="animate-spin mb-4 text-[#38BDF8]" size={48} />
            <p>Carregando perfil de acesso...</p>
        </div>
    )
  }

  if (!profile) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle className="mb-4" size={48} />
            <p className="text-lg font-bold">Erro de Acesso</p>
            <p className="text-sm opacity-80 mb-4">Não foi possível carregar seu perfil de usuário.</p>
            <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-industrial-surface border border-industrial-border rounded-lg text-white hover:bg-industrial-surface/80 transition-colors"
            >
                Tentar Novamente
            </button>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-white">Gerenciamento de Usuários</h2>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="h-10 px-6 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0B0F14] font-bold tracking-wide transition shadow-[0_12px_30px_rgba(56,189,248,0.35)] hover:-translate-y-[1px] flex items-center gap-2"
          >
            <UserPlus size={18} />
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

      <div className="bg-industrial-surface rounded-2xl border border-industrial-border overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-industrial-border flex items-center bg-industrial-bg/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-industrial-text-secondary" size={18} />
            <input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-full h-10 bg-industrial-bg border border-industrial-border rounded-lg text-white placeholder:text-gray-500 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all"
            />
          </div>
        </div>

        <HorizontalScrollArea className="overflow-x-scroll touch-pan-y">
            <table className="w-full">
            <thead className="bg-industrial-bg/80 text-industrial-text-secondary text-xs uppercase tracking-wider font-semibold">
                <tr>
                <th className="px-6 py-4 text-left">Colaborador</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Perfil</th>
                <th className="px-6 py-4 text-right">Ações</th>
                </tr>
            </thead>

            <tbody className="divide-y divide-industrial-border">
                {loading ? (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-industrial-text-secondary">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-[#38BDF8]" size={32} />
                        <p>Carregando equipe...</p>
                    </div>
                    </td>
                </tr>
                ) : usuarios.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-industrial-text-secondary">
                    Nenhum usuário encontrado
                    </td>
                </tr>
                ) : (
                usuarios.map(user => (
                    <tr key={user.id} className="hover:bg-industrial-bg/40 transition-colors group">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-industrial-bg border border-industrial-border flex items-center justify-center text-white font-bold">
                                {user.nome.charAt(0)}
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">{user.nome}</p>
                                <p className="text-xs text-industrial-text-secondary">{user.email_login}</p>
                            </div>
                        </div>
                    </td>

                    <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                            {user.telefone && <div className="flex items-center gap-1"><Phone size={12} className="text-industrial-text-secondary"/> {user.telefone}</div>}
                            {user.email_corporativo && <div className="flex items-center gap-1 mt-1"><Mail size={12} className="text-industrial-text-secondary"/> {user.email_corporativo}</div>}
                        </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                        <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            user.ativo
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                        >
                        <span className={`w-1.5 h-1.5 rounded-full ${user.ativo ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {user.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                        <span className="text-white font-medium bg-industrial-bg px-3 py-1 rounded-lg border border-industrial-border text-xs tracking-wide">
                            {(user as any)?.rbac_perfil?.perfil_nome || 'N/A'}
                        </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => toggleStatus(user)}
                            disabled={!isAdmin || user.id === profile.id}
                            className={`p-2 rounded-lg transition-colors ${
                            user.ativo
                                ? 'hover:bg-rose-500/10 hover:text-rose-400 text-gray-400'
                                : 'hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-400'
                            }`}
                            title={user.ativo ? 'Desativar acesso' : 'Ativar acesso'}
                        >
                            {user.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>

                        <button
                            onClick={() => handleOpenEdit(user)}
                            disabled={!isAdmin}
                            className="p-2 text-gray-400 hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded-lg transition-colors"
                            title="Editar dados"
                        >
                            <Edit2 size={18} />
                        </button>
                        
                         {/* TODO: Implementar Reset de Senha no Modal ou separado */}
                        </div>
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </HorizontalScrollArea>
      </div>

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-[#0F172A] w-full max-w-2xl rounded-2xl border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {editingUser ? <Edit2 className="text-[#38BDF8]" size={20} /> : <UserPlus className="text-[#38BDF8]" size={20} />}
                        {editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Preencha os dados corporativos e de acesso.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar">
                {formError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <span>{formError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Seção Pessoal */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider mb-2 flex items-center gap-2">
                            <User size={14} /> Dados Pessoais
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Nome Completo *</label>
                                <input 
                                    required
                                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                    placeholder="Ex: João da Silva"
                                    value={formData.nome}
                                    onChange={e => setFormData({...formData, nome: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Perfil de Acesso *</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all appearance-none cursor-pointer"
                                        value={formData.perfil_id}
                                        onChange={e => setFormData({...formData, perfil_id: e.target.value})}
                                    >
                                        {perfis.map(p => (
                                            <option key={p.perfil_id} value={p.perfil_id}>{p.perfil_nome}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/5" />

                    {/* Seção Contato */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Building size={14} /> Contato Corporativo
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Email Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                    <input 
                                        type="email"
                                        className="w-full bg-[#0B0F14] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                        placeholder="nome@empresa.com"
                                        value={formData.email_corporativo}
                                        onChange={e => setFormData({...formData, email_corporativo: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Telefone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                        <input 
                                            className="w-full bg-[#0B0F14] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                            placeholder="(00) 00000-0000"
                                            value={formData.telefone}
                                            onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})}
                                            maxLength={15}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Ramal</label>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                        <input 
                                            className="w-full bg-[#0B0F14] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                            placeholder="Ex: 1234"
                                            value={formData.ramal}
                                            onChange={e => setFormData({...formData, ramal: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/5" />

                    {/* Seção Acesso */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Key size={14} /> Credenciais de Acesso
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">Email de Login *</label>
                                <input 
                                    type="email"
                                    required
                                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                    placeholder="usuario@login.com"
                                    value={formData.email_login}
                                    onChange={e => setFormData({...formData, email_login: e.target.value})}
                                    // Se estiver editando, talvez queira bloquear ou avisar
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase">
                                    {editingUser ? 'Nova Senha (Opcional)' : 'Senha Inicial *'}
                                </label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                    <input 
                                        type="password"
                                        required={!editingUser}
                                        className="w-full bg-[#0B0F14] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all placeholder:text-gray-600"
                                        placeholder={editingUser ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                                        value={formData.senha}
                                        onChange={e => setFormData({...formData, senha: e.target.value})}
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        {editingUser && (
                            <div className="flex items-center gap-3 pt-2">
                                <label className="text-sm text-gray-400">Status da Conta:</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : 'bg-white/10'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${formData.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className={`text-sm font-bold ${formData.ativo ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {formData.ativo ? 'ATIVO' : 'INATIVO'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t border-white/5 mt-8">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={formLoading}
                            className="bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0B0F14] px-8 py-3 rounded-xl font-bold tracking-wide transition shadow-[0_10px_20px_rgba(56,189,248,0.2)] hover:-translate-y-[1px] disabled:opacity-60 flex items-center gap-2"
                        >
                            {formLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {formLoading ? 'Salvando...' : 'Salvar Colaborador'}
                        </button>
                    </div>
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
