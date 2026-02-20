import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/services/api'
import { Loader2, Plus, Trash2 } from 'lucide-react'

type Perfil = {
  perfil_id: string
  perfil_nome: string
  perfil_descricao?: string | null
  ativo?: boolean | null
}

export default function PermissoesRbac() {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [activePerfilId, setActivePerfilId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newPerfilNome, setNewPerfilNome] = useState('')
  const [newPerfilDescricao, setNewPerfilDescricao] = useState('')
  const [creating, setCreating] = useState(false)

  const [perfilDraft, setPerfilDraft] = useState({
    nome: '',
    descricao: '',
    ativo: true
  })

  const activePerfil = useMemo(
    () => perfis.find(p => p.perfil_id === activePerfilId) || null,
    [perfis, activePerfilId]
  )

  const loadBase = async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ perfis: perfisData }] = await Promise.all([api.rbac.listPerfis()])
      setPerfis(perfisData || [])
      const firstPerfilId = (perfisData || [])[0]?.perfil_id ?? null
      setActivePerfilId(prev => prev ?? firstPerfilId)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar perfis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBase()
  }, [])

  useEffect(() => {
    if (!activePerfil) return
    setPerfilDraft({
      nome: activePerfil.perfil_nome || '',
      descricao: activePerfil.perfil_descricao || '',
      ativo: activePerfil.ativo !== false
    })
  }, [activePerfilId, activePerfil?.perfil_nome, activePerfil?.perfil_descricao, activePerfil?.ativo])

  const savePerfil = async () => {
    if (!activePerfilId) return
    setSavingPerfil(true)
    setError(null)
    try {
      const nome = perfilDraft.nome.trim()
      if (!nome) {
        setError('Nome do perfil é obrigatório.')
        return
      }

      await api.rbac.updatePerfil(activePerfilId, {
        perfil_nome: nome,
        perfil_descricao: perfilDraft.descricao.trim() || null,
        ativo: perfilDraft.ativo
      } as any)

      await loadBase()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar perfil.')
    } finally {
      setSavingPerfil(false)
    }
  }

  const createPerfil = async () => {
    const nome = newPerfilNome.trim().toUpperCase()
    if (!nome) return
    setCreating(true)
    setError(null)
    try {
      const created = await api.rbac.createPerfil({
        perfil_nome: nome,
        perfil_descricao: newPerfilDescricao.trim() || null
      })
      await loadBase()
      setActivePerfilId(created?.perfil_id ?? null)
      setNewPerfilNome('')
      setNewPerfilDescricao('')
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar perfil.')
    } finally {
      setCreating(false)
    }
  }

  const deletePerfil = async (perfilId: string) => {
    const p = perfis.find(x => x.perfil_id === perfilId)
    if (!p) return
    if (p.perfil_nome === 'ADMIN' || p.perfil_nome === 'ADMINISTRADOR') return
    if (!confirm(`Remover o perfil ${p.perfil_nome}?`)) return

    setError(null)
    try {
      await api.rbac.deletePerfil(perfilId)
      await loadBase()
    } catch (e: any) {
      setError(e?.message || 'Erro ao remover perfil.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-industrial-text-secondary">
        <Loader2 className="animate-spin text-[#38BDF8]" size={32} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 bg-industrial-surface rounded-2xl border border-industrial-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-white">Perfis de Permissão</div>
        </div>

        <div className="space-y-2">
          {perfis.map(p => (
            <div
              key={p.perfil_id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors ${
                activePerfilId === p.perfil_id
                  ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10'
                  : 'border-industrial-border bg-industrial-bg/30 hover:bg-industrial-bg/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setActivePerfilId(p.perfil_id)}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-sm font-black text-white truncate">{p.perfil_nome}</div>
                <div className="text-xs text-industrial-text-secondary truncate">
                  {p.perfil_descricao || 'Sem descrição'}
                </div>
              </button>
              <button
                type="button"
                disabled={p.perfil_nome === 'ADMIN' || p.perfil_nome === 'ADMINISTRADOR'}
                onClick={() => deletePerfil(p.perfil_id)}
                className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 disabled:hover:bg-transparent"
                title="Excluir perfil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-industrial-border">
          <div className="text-xs font-bold text-industrial-text-secondary uppercase mb-2">Novo perfil</div>
          <div className="space-y-2">
            <input
              value={newPerfilNome}
              onChange={e => setNewPerfilNome(e.target.value)}
              placeholder="NOME (ex.: COMERCIAL)"
              className="w-full h-10 bg-industrial-bg border border-industrial-border rounded-xl px-3 text-white placeholder:text-gray-600 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
            />
            <input
              value={newPerfilDescricao}
              onChange={e => setNewPerfilDescricao(e.target.value)}
              placeholder="Descrição"
              className="w-full h-10 bg-industrial-bg border border-industrial-border rounded-xl px-3 text-white placeholder:text-gray-600 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
            />
            <button
              type="button"
              onClick={createPerfil}
              disabled={creating || !newPerfilNome.trim()}
              className="w-full h-10 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0B0F14] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Criar
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 bg-industrial-surface rounded-2xl border border-industrial-border p-4 flex flex-col min-h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-white truncate">
              {activePerfil ? `Perfil: ${activePerfil.perfil_nome}` : 'Perfil'}
            </div>
            <div className="text-xs text-industrial-text-secondary">
              Crie e mantenha os perfis padrão. As permissões ficam na aba Páginas.
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {activePerfil && (
          <div className="mb-4 rounded-2xl border border-industrial-border bg-industrial-bg/20 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <div className="text-[11px] font-bold text-industrial-text-secondary uppercase mb-1">Nome</div>
                <input
                  value={perfilDraft.nome}
                  onChange={(e) => setPerfilDraft((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full h-10 bg-industrial-bg border border-industrial-border rounded-xl px-3 text-white placeholder:text-gray-600 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="text-[11px] font-bold text-industrial-text-secondary uppercase mb-1">Descrição</div>
                <input
                  value={perfilDraft.descricao}
                  onChange={(e) => setPerfilDraft((p) => ({ ...p, descricao: e.target.value }))}
                  className="w-full h-10 bg-industrial-bg border border-industrial-border rounded-xl px-3 text-white placeholder:text-gray-600 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
                />
              </div>
              <div className="sm:col-span-3 flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPerfilDraft((p) => ({ ...p, ativo: !p.ativo }))}
                  className={`h-10 px-4 rounded-xl border text-xs font-bold transition-colors ${
                    perfilDraft.ativo
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {perfilDraft.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  type="button"
                  onClick={savePerfil}
                  disabled={savingPerfil}
                  className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs disabled:opacity-60"
                >
                  {savingPerfil ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />
      </div>
    </div>
  )
}
