import React, { useEffect, useMemo, useState } from 'react'
import PermissoesRbac from '@/pages/Configuracoes/PermissoesRbac'
import { api } from '@/services/api'
import { APP_MENUS_ORDER, APP_PAGES } from '@/constants/appPages'
import { Loader2, Save } from 'lucide-react'

export default function PermissoesPage() {
  const [tab, setTab] = useState<'perfis' | 'paginas'>('paginas')

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-white">Gestão de Acessos</h1>
        <p className="text-sm text-industrial-text-secondary">Defina acesso por página e nível de permissão</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('perfis')}
          className={`h-10 px-4 rounded-xl border text-sm font-bold transition-colors ${
            tab === 'perfis'
              ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-white'
              : 'border-industrial-border bg-industrial-surface text-industrial-text-secondary hover:text-white hover:bg-industrial-bg/30'
          }`}
        >
          Perfis Padrões
        </button>
        <button
          type="button"
          onClick={() => setTab('paginas')}
          className={`h-10 px-4 rounded-xl border text-sm font-bold transition-colors ${
            tab === 'paginas'
              ? 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-white'
              : 'border-industrial-border bg-industrial-surface text-industrial-text-secondary hover:text-white hover:bg-industrial-bg/30'
          }`}
        >
          Permissões
        </button>
      </div>

      {tab === 'perfis' ? <PermissoesRbac /> : <PermissoesPaginas />}
    </div>
  )
}

function PermissoesPaginas() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [perfilQuery, setPerfilQuery] = useState('')
  const [perfis, setPerfis] = useState<any[]>([])
  const [permissoes, setPermissoes] = useState<any[]>([])
  const [activePerfilId, setActivePerfilId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set())

  const permIdByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of permissoes || []) {
      if (p?.modulo && p?.acao && p?.permissao_id) {
        map.set(`${p.modulo}:${p.acao}`, p.permissao_id)
      }
    }
    return map
  }, [permissoes])

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
      setActivePerfilId((perfisData || [])[0]?.perfil_id ?? null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar perfis e permissões.')
    } finally {
      setLoading(false)
    }
  }

  const loadPerfilPerms = async (perfilId: string) => {
    setError(null)
    setSuccess(null)
    try {
      const { itens } = await api.rbac.getPerfilPermissoes(perfilId)
      const next = new Set<string>((itens || []).map((i: any) => i.permissao_id))
      setSelected(next)
      setInitialSelected(new Set(next))
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

  const filteredPerfis = useMemo(() => {
    const q = perfilQuery.trim().toLowerCase()
    const sorted = [...(perfis || [])].sort((a, b) => String(a?.perfil_nome || '').localeCompare(String(b?.perfil_nome || '')))
    if (!q) return sorted
    const list = sorted.filter((p: any) => String(p?.perfil_nome || '').toLowerCase().includes(q))
    if (!activePerfilId) return list
    if (list.some((p: any) => p?.perfil_id === activePerfilId)) return list
    const current = sorted.find((p: any) => p?.perfil_id === activePerfilId)
    return current ? [current, ...list] : list
  }, [perfis, perfilQuery, activePerfilId])

  const groupedMenus = useMemo(() => {
    const byMenu = new Map<string, typeof APP_PAGES>()
    for (const p of APP_PAGES) {
      const key = p.menu || 'Outros'
      const list = byMenu.get(key) || []
      list.push(p)
      byMenu.set(key, list)
    }

    for (const [k, list] of byMenu.entries()) {
      list.sort((a, b) => String(a.item || a.label).localeCompare(String(b.item || b.label)))
      byMenu.set(k, list)
    }

    const order = new Map<string, number>((APP_MENUS_ORDER as unknown as string[]).map((m, i) => [m, i]))
    return Array.from(byMenu.entries()).sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
  }, [])

  const togglePage = (modulo: string, acao: string, checked: boolean) => {
    setSuccess(null)
    const viewId = permIdByKey.get(`${modulo}:VIEW`)
    const editId = permIdByKey.get(`${modulo}:EDIT`)
    const controlId = permIdByKey.get(`${modulo}:CONTROL`)

    setSelected((prev) => {
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

  const isDirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true
    for (const id of selected) {
      if (!initialSelected.has(id)) return true
    }
    return false
  }, [initialSelected, selected])

  const save = async () => {
    if (!activePerfilId) return
    if (!isDirty) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const final = new Set(selected)

      const ensureBase = (baseModulo: string, acao: 'VIEW' | 'EDIT' | 'CONTROL') => {
        const viewId = permIdByKey.get(`${baseModulo}:VIEW`)
        const editId = permIdByKey.get(`${baseModulo}:EDIT`)
        const controlId = permIdByKey.get(`${baseModulo}:CONTROL`)

        if (acao === 'CONTROL') {
          if (controlId) final.add(controlId)
          if (editId) final.add(editId)
          if (viewId) final.add(viewId)
        } else if (acao === 'EDIT') {
          if (editId) final.add(editId)
          if (viewId) final.add(viewId)
        } else {
          if (viewId) final.add(viewId)
        }
      }

      for (const pg of APP_PAGES) {
        if (!pg.pageModulo || !pg.baseModulo) continue
        const viewId = permIdByKey.get(`${pg.pageModulo}:VIEW`)
        const editId = permIdByKey.get(`${pg.pageModulo}:EDIT`)
        const controlId = permIdByKey.get(`${pg.pageModulo}:CONTROL`)

        const hasView = viewId ? final.has(viewId) : false
        const hasEdit = editId ? final.has(editId) : false
        const hasControl = controlId ? final.has(controlId) : false

        if (hasControl) ensureBase(pg.baseModulo, 'CONTROL')
        else if (hasEdit) ensureBase(pg.baseModulo, 'EDIT')
        else if (hasView) ensureBase(pg.baseModulo, 'VIEW')
      }

      await api.rbac.setPerfilPermissoes(activePerfilId, Array.from(final))
      setSelected(final)
      setInitialSelected(new Set(final))
      setSuccess('Alterações salvas com sucesso.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar permissões.')
    } finally {
      setSaving(false)
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
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {success}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <div className="text-[11px] font-bold text-industrial-text-secondary uppercase mb-1">Selecione o Perfil</div>
            <input
              value={perfilQuery}
              onChange={(e) => setPerfilQuery(e.target.value)}
              placeholder="Filtrar perfis..."
              className="w-full h-10 bg-industrial-surface border border-industrial-border rounded-xl px-3 text-white placeholder:text-gray-600 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
            />
          </div>
          <div>
            <div className="text-[11px] font-bold text-industrial-text-secondary uppercase mb-1">Perfil</div>
            <select
              value={activePerfilId ?? ''}
              onChange={(e) => setActivePerfilId(e.target.value || null)}
              className="w-full h-10 bg-industrial-surface border border-industrial-border rounded-xl px-3 text-white focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none"
            >
              {filteredPerfis.map((p: any) => (
                <option key={p.perfil_id} value={p.perfil_id}>
                  {p.perfil_nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !activePerfilId || !isDirty}
          className={`h-10 px-4 rounded-xl text-[#0B0F14] font-extrabold flex items-center justify-center gap-2 transition ${
            saving || !activePerfilId || !isDirty
              ? 'bg-[#38BDF8]/40 opacity-60'
              : 'bg-[#38BDF8] hover:bg-[#0EA5E9] shadow-[0_12px_30px_rgba(56,189,248,0.35)] hover:-translate-y-[1px]'
          }`}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Salvando...' : isDirty ? 'Salvar alterações' : 'Sem alterações'}
        </button>
      </div>

      <div className="bg-industrial-surface rounded-2xl border border-industrial-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-industrial-bg/80 text-industrial-text-secondary text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4 text-left">Menu</th>
              <th className="px-6 py-4 text-center">View</th>
              <th className="px-6 py-4 text-center">Criar/Editar</th>
              <th className="px-6 py-4 text-center">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-border">
            {groupedMenus.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-industrial-text-secondary">
                  Nenhuma página encontrada
                </td>
              </tr>
            ) : (
              groupedMenus.flatMap(([menu, pages]) => {
                const enabledCount = pages.reduce((acc, pg) => {
                  if (!pg.pageModulo) return acc
                  const viewId = permIdByKey.get(`${pg.pageModulo}:VIEW`)
                  return acc + (viewId && selected.has(viewId) ? 1 : 0)
                }, 0)
                const menuEnabled = enabledCount > 0
                const canToggleMenu = Boolean(activePerfilId) && pages.some((p) => Boolean(p.pageModulo))

                const menuRow = (
                  <tr key={`menu:${menu}`} className="bg-industrial-bg/40">
                    <td className="px-6 py-4 text-white text-sm font-extrabold">
                      <div className="flex items-center gap-3">
                        <span>{menu}</span>
                        <label className="flex items-center gap-2 text-xs text-industrial-text-secondary font-bold">
                          <input
                            type="checkbox"
                            disabled={!canToggleMenu}
                            checked={menuEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked
                              for (const pg of pages) {
                                if (!pg.pageModulo) continue
                                togglePage(pg.pageModulo, 'VIEW', checked)
                              }
                            }}
                            className="h-4 w-4 accent-[#38BDF8] disabled:opacity-50"
                          />
                          habilitar
                        </label>
                        {!activePerfilId && (
                          <span className="text-[11px] text-industrial-text-secondary">selecione um perfil</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">—</td>
                    <td className="px-6 py-4 text-center">—</td>
                    <td className="px-6 py-4 text-center">—</td>
                  </tr>
                )

                const pageRows = pages.map((pg) => {
                  const hasMapping = Boolean(pg.pageModulo)

                  const viewId = hasMapping ? permIdByKey.get(`${pg.pageModulo}:VIEW`) : null
                  const editId = hasMapping ? permIdByKey.get(`${pg.pageModulo}:EDIT`) : null
                  const controlId = hasMapping ? permIdByKey.get(`${pg.pageModulo}:CONTROL`) : null

                  const viewChecked = viewId ? selected.has(viewId) : false
                  const editChecked = editId ? selected.has(editId) : false
                  const controlChecked = controlId ? selected.has(controlId) : false

                  const disabled = !activePerfilId || !hasMapping
                  return (
                    <tr key={pg.path} className="hover:bg-industrial-bg/40 transition-colors">
                      <td className="px-6 py-4 text-white text-sm">
                        <div className="flex flex-col">
                          <span className="font-bold">- {pg.item || pg.label}</span>
                          <span className="text-xs font-mono text-industrial-text-secondary">{pg.path}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasMapping ? (
                          <input
                            type="checkbox"
                            disabled={disabled || !viewId}
                            checked={viewChecked}
                            onChange={(e) => togglePage(pg.pageModulo as string, 'VIEW', e.target.checked)}
                            className="h-4 w-4 accent-[#38BDF8] disabled:opacity-50"
                          />
                        ) : (
                          <span className="text-industrial-text-secondary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasMapping ? (
                          <input
                            type="checkbox"
                            disabled={disabled || !editId}
                            checked={editChecked}
                            onChange={(e) => togglePage(pg.pageModulo as string, 'EDIT', e.target.checked)}
                            className="h-4 w-4 accent-[#38BDF8] disabled:opacity-50"
                          />
                        ) : (
                          <span className="text-industrial-text-secondary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasMapping ? (
                          <input
                            type="checkbox"
                            disabled={disabled || !controlId}
                            checked={controlChecked}
                            onChange={(e) => togglePage(pg.pageModulo as string, 'CONTROL', e.target.checked)}
                            className="h-4 w-4 accent-[#38BDF8] disabled:opacity-50"
                          />
                        ) : (
                          <span className="text-industrial-text-secondary text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })

                return [menuRow, ...pageRows]
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
