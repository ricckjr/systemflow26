import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/services/api'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

type Perfil = {
  perfil_id: string
  perfil_nome: string
  perfil_descricao?: string | null
}

type Permissao = {
  permissao_id: string
  modulo: string
  acao: string
  descricao?: string | null
}

const APPLICABLE_MODULES = [
  'DASHBOARD',
  'UNIVERSIDADE',
  'CRM',
  'PRODUCAO',
  'FROTA',
  'SMARTFLOW',
  'CONFIGURACOES'
] as const

const ACTIONS = ['VIEW', 'EDIT', 'CONTROL'] as const

function prettyActionLabel(acao: string) {
  if (acao === 'VIEW') return 'View'
  if (acao === 'EDIT') return 'Criar-Editar'
  if (acao === 'CONTROL') return 'Control'
  return acao
}

export default function PermissoesRbac() {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [permissoes, setPermissoes] = useState<Permissao[]>([])
  const [activePerfilId, setActivePerfilId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newPerfilNome, setNewPerfilNome] = useState('')
  const [newPerfilDescricao, setNewPerfilDescricao] = useState('')
  const [creating, setCreating] = useState(false)

  const activePerfil = useMemo(
    () => perfis.find(p => p.perfil_id === activePerfilId) || null,
    [perfis, activePerfilId]
  )

  const filteredPermissoes = useMemo(() => {
    const allowedModules = new Set<string>(APPLICABLE_MODULES as unknown as string[])
    const allowedActions = new Set<string>(ACTIONS as unknown as string[])
    return (permissoes || []).filter(p => allowedModules.has(p.modulo) && allowedActions.has(p.acao))
  }, [permissoes])

  const permIdByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of filteredPermissoes) {
      map.set(`${p.modulo}:${p.acao}`, p.permissao_id)
    }
    return map
  }, [filteredPermissoes])

  const grouped = useMemo(() => {
    const map = new Map<string, Permissao[]>()
    for (const p of filteredPermissoes) {
      const list = map.get(p.modulo) || []
      list.push(p)
      map.set(p.modulo, list)
    }
    const order = new Map<string, number>((APPLICABLE_MODULES as unknown as string[]).map((m, i) => [m, i]))
    return Array.from(map.entries()).sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
  }, [filteredPermissoes])

  const loadBase = async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ perfis: perfisData }, { permissoes: permissoesData }] = await Promise.all([
        api.rbac.listPerfis(),
        api.rbac.listPermissoes()
      ])
      setPerfis(perfisData || [])
      setPermissoes(permissoesData || [])
      const firstPerfilId = (perfisData || [])[0]?.perfil_id ?? null
      setActivePerfilId(prev => prev ?? firstPerfilId)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar perfis e permissões.')
    } finally {
      setLoading(false)
    }
  }

  const loadPerfilPerms = async (perfilId: string) => {
    setError(null)
    try {
      const { itens } = await api.rbac.getPerfilPermissoes(perfilId)
      const set = new Set<string>((itens || []).map((i: any) => i.permissao_id))
      setSelected(set)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar permissões do perfil.')
    }
  }

  useEffect(() => {
    loadBase()
  }, [])

  useEffect(() => {
    if (!activePerfilId) return
    loadPerfilPerms(activePerfilId)
  }, [activePerfilId])

  const setModuleAction = (modulo: string, acao: string, checked: boolean) => {
    const viewId = permIdByKey.get(`${modulo}:VIEW`)
    const editId = permIdByKey.get(`${modulo}:EDIT`)
    const controlId = permIdByKey.get(`${modulo}:CONTROL`)

    setSelected(prev => {
      const next = new Set(prev)

      const add = (id?: string) => {
        if (id) next.add(id)
      }
      const del = (id?: string) => {
        if (id) next.delete(id)
      }

      if (acao === 'CONTROL') {
        if (checked) {
          add(controlId)
          add(editId)
          add(viewId)
        } else {
          del(controlId)
        }
      } else if (acao === 'EDIT') {
        if (checked) {
          add(editId)
          add(viewId)
        } else {
          del(editId)
          del(controlId)
        }
      } else if (acao === 'VIEW') {
        if (checked) {
          add(viewId)
        } else {
          del(viewId)
          del(editId)
          del(controlId)
        }
      }

      if (controlId && next.has(controlId)) {
        add(editId)
        add(viewId)
      }
      if (editId && next.has(editId)) {
        add(viewId)
      }

      return next
    })
  }

  const save = async () => {
    if (!activePerfilId) return
    setSaving(true)
    setError(null)
    try {
      const final = new Set(selected)
      for (const modulo of APPLICABLE_MODULES as unknown as string[]) {
        const viewId = permIdByKey.get(`${modulo}:VIEW`)
        const editId = permIdByKey.get(`${modulo}:EDIT`)
        const controlId = permIdByKey.get(`${modulo}:CONTROL`)
        if (controlId && final.has(controlId)) {
          if (editId) final.add(editId)
          if (viewId) final.add(viewId)
        }
        if (editId && final.has(editId)) {
          if (viewId) final.add(viewId)
        }
      }

      await api.rbac.setPerfilPermissoes(activePerfilId, Array.from(final))
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar permissões.')
    } finally {
      setSaving(false)
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
          <div className="text-sm font-bold text-white">Perfis</div>
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
              {activePerfil ? `Permissões: ${activePerfil.perfil_nome}` : 'Permissões'}
            </div>
            <div className="text-xs text-industrial-text-secondary">
              Selecione View / Criar-Editar / Control por módulo
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {grouped.map(([modulo, list]) => (
            <div key={modulo} className="rounded-2xl border border-industrial-border bg-industrial-bg/20 p-4">
              <div className="text-xs font-black text-[#38BDF8] uppercase tracking-wider mb-3">{modulo}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACTIONS.map((acao) => {
                  const p = list.find(x => x.acao === acao) || null
                  const permissaoId = p?.permissao_id || ''
                  const checked = permissaoId ? selected.has(permissaoId) : false
                  const disabled = !p
                  return (
                    <label
                      key={`${modulo}:${acao}`}
                      className={`flex items-center gap-3 rounded-xl border border-industrial-border bg-industrial-surface px-3 py-2 ${
                        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-industrial-surface/80 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => setModuleAction(modulo, acao, e.target.checked)}
                        className="h-4 w-4 accent-[#38BDF8]"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{prettyActionLabel(acao)}</div>
                        <div className="text-xs text-industrial-text-secondary truncate">
                          {p?.descricao || ''}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 pt-4 bg-industrial-surface">
          <button
            type="button"
            onClick={save}
            disabled={!activePerfilId || saving}
            className="w-full h-10 px-4 rounded-xl bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#0B0F14] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
