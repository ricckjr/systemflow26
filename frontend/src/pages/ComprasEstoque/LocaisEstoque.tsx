import React, { useEffect, useMemo, useState } from 'react'
import { Box, Loader2, Pencil, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { Modal } from '@/components/ui'

type LocalEstoque = {
  local_id: string
  nome: string
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

type VinculosInfo = {
  produtos_count: number
  quantidade_total: number
  movimentos_count: number
  produtos: Array<{ prod_id: string; descricao: string; saldo: number }>
}

const formatUnknownError = (err: unknown) => {
  if (err instanceof Error) return err.message || 'Erro'
  if (typeof err === 'string') return err || 'Erro'
  if (!err || typeof err !== 'object') return 'Erro'
  const anyErr = err as any
  const message = typeof anyErr?.message === 'string' ? anyErr.message : ''
  const details = typeof anyErr?.details === 'string' ? anyErr.details : ''
  const hint = typeof anyErr?.hint === 'string' ? anyErr.hint : ''
  const parts = [message, details, hint].map((p) => String(p || '').trim()).filter(Boolean)
  return parts[0] ? parts.join(' — ') : 'Erro'
}

const formatQty = (value: number) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0'
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  return n.toLocaleString('pt-BR', { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: 2 })
}

export default function LocaisEstoque() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LocalEstoque[]>([])
  const [quantidadeByNome, setQuantidadeByNome] = useState<Record<string, number>>({})

  const [search, setSearch] = useState('')
  const [novoNome, setNovoNome] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<LocalEstoque | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<VinculosInfo | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadQuantidades = async (locais: LocalEstoque[]) => {
    const nomes = Array.from(new Set((locais || []).map((l) => String(l.nome || '').trim()).filter(Boolean)))
    if (nomes.length === 0) {
      setQuantidadeByNome({})
      return
    }

    try {
      const { data, error: qError } = await (supabase as any)
        .from('vw_saldo_produto')
        .select('local_estoque,saldo')
        .in('local_estoque', nomes)

      if (qError) throw qError

      const map: Record<string, number> = {}
      for (const nome of nomes) map[nome] = 0
      for (const row of (data || []) as any[]) {
        const local = String(row?.local_estoque || '').trim()
        const saldo = Number(row?.saldo ?? 0)
        if (!local) continue
        if (!Number.isFinite(saldo)) continue
        map[local] = Number(map[local] ?? 0) + saldo
      }
      setQuantidadeByNome(map)
    } catch {
      setQuantidadeByNome({})
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qError } = await (supabase as any)
        .from('crm_locais_estoque')
        .select('local_id,nome,ativo,criado_em,atualizado_em')
        .order('nome', { ascending: true })
      if (qError) throw qError
      const next = (data || []) as LocalEstoque[]
      setItems(next)
      void loadQuantidades(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar locais')
      setItems([])
      setQuantidadeByNome({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => String(i.nome || '').toLowerCase().includes(term))
  }, [items, search])

  const handleCreate = async () => {
    const nome = novoNome.trim()
    if (!nome) {
      setError('Informe o nome do local.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const exists = items.some((i) => i.nome.trim().toLowerCase() === nome.toLowerCase())
      if (exists) {
        setError('Já existe um local com esse nome.')
        return
      }

      const { error: insError } = await (supabase as any).from('crm_locais_estoque').insert({ nome, ativo: true })
      if (insError) throw insError
      setNovoNome('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar local')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (item: LocalEstoque) => {
    setSaving(true)
    setError(null)
    try {
      const { error: upError } = await (supabase as any)
        .from('crm_locais_estoque')
        .update({ ativo: !item.ativo, atualizado_em: new Date().toISOString() })
        .eq('local_id', item.local_id)
      if (upError) throw upError
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar local')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: LocalEstoque) => {
    setError(null)
    setEditingId(item.local_id)
    setEditNome(item.nome || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditNome('')
  }

  const handleSaveEdit = async (item: LocalEstoque) => {
    const nome = editNome.trim()
    if (!nome) {
      setError('Informe o nome do local.')
      return
    }

    const exists = items.some((i) => i.local_id !== item.local_id && i.nome.trim().toLowerCase() === nome.toLowerCase())
    if (exists) {
      setError('Já existe um local com esse nome.')
      return
    }

    setEditSaving(true)
    setError(null)
    try {
      const { error: rpcError } = await (supabase as any).rpc('crm_renomear_local_estoque_admin', {
        p_local_id: item.local_id,
        p_novo_nome: nome
      })
      if (rpcError) throw rpcError
      cancelEdit()
      await load()
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setEditSaving(false)
    }
  }

  const openDelete = async (item: LocalEstoque) => {
    setError(null)
    setDeleteTarget(item)
    setDeleteInfo(null)
    setDeleteLoading(true)
    setDeleting(false)
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('crm_local_estoque_vinculos', {
        p_nome: item.nome,
        p_limit: 12
      })
      if (rpcError) throw rpcError
      const row = Array.isArray(data) ? data[0] : data
      const produtosRaw = Array.isArray(row?.produtos) ? row.produtos : []
      const info: VinculosInfo = {
        produtos_count: Number(row?.produtos_count ?? 0) || 0,
        quantidade_total: Number(row?.quantidade_total ?? 0) || 0,
        movimentos_count: Number(row?.movimentos_count ?? 0) || 0,
        produtos: produtosRaw.map((p: any) => ({
          prod_id: String(p?.prod_id || ''),
          descricao: String(p?.descricao || ''),
          saldo: Number(p?.saldo ?? 0) || 0
        }))
      }
      setDeleteInfo(info)
    } catch (e) {
      setDeleteInfo(null)
      setError(formatUnknownError(e))
    } finally {
      setDeleteLoading(false)
    }
  }

  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteInfo(null)
    setDeleteLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      const { error: rpcError } = await (supabase as any).rpc('crm_excluir_local_estoque_admin', { p_local_id: deleteTarget.local_id })
      if (rpcError) throw rpcError
      closeDelete()
      await load()
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="pt-4 pb-6 max-w-[1400px] mx-auto px-4 md:px-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
          <Box size={14} />
          Locais do Estoque
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar local..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
            />
          </div>

          <div className="md:col-span-5">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Novo local (ex: Prateleira C)"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !novoNome.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Criar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--text-muted)]">Nenhum local encontrado.</div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-[var(--border)]">
              <div className="col-span-7 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Prateleira</div>
              <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Itens</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Status</div>
              <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Ações</div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {filtered.map((i) => (
                <div key={i.local_id} className="grid grid-cols-12 gap-3 px-4 py-3">
                  <div className="col-span-7 min-w-0">
                    {editingId === i.local_id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(i)}
                          disabled={editSaving || saving}
                          className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:pointer-events-none transition-colors"
                          title="Salvar"
                        >
                          {editSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={editSaving || saving}
                          className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)] truncate" title={i.nome}>
                          {i.nome}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-mono font-semibold text-emerald-200">{formatQty(quantidadeByNome[i.nome] ?? 0)}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">itens</div>
                  </div>
                  <div className="col-span-1">
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        i.ativo
                          ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-200 border-white/10'
                      }`}
                    >
                      {i.ativo ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      disabled={saving || editSaving || deleting || editingId === i.local_id}
                      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                      title="Editar nome"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(i)}
                      disabled={saving || editSaving || deleting}
                      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-rose-500/30 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(i)}
                      disabled={saving || editSaving || deleting}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                      title={i.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {i.ativo ? <ToggleRight size={18} className="text-emerald-300" /> : <ToggleLeft size={18} className="text-slate-400" />}
                      <span className="text-xs font-bold">{i.ativo ? 'Desativar' : 'Ativar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={closeDelete}
        size="md"
        className="max-w-xl"
        zIndex={140}
        title={
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Locais do Estoque</div>
            <div className="text-base font-bold text-[var(--text-main)] truncate">Excluir prateleira</div>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeDelete}
              disabled={deleting}
              className="px-6 py-2.5 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={
                deleting ||
                deleteLoading ||
                !deleteTarget ||
                !!(deleteInfo && (deleteInfo.movimentos_count > 0 || deleteInfo.produtos_count > 0))
              }
              className="px-7 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/15 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 inline-flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-200">
            Prateleira: <span className="font-semibold">{deleteTarget?.nome || '-'}</span>
          </div>

          {deleteLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
            </div>
          ) : deleteInfo ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Quantidade</div>
                  <div className="mt-1 text-sm font-mono font-semibold text-emerald-200">{formatQty(deleteInfo.quantidade_total)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Produtos com saldo</div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-100">{Number(deleteInfo.produtos_count || 0).toLocaleString('pt-BR')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Movimentações</div>
                  <div className="mt-1 text-sm font-mono font-semibold text-slate-100">{Number(deleteInfo.movimentos_count || 0).toLocaleString('pt-BR')}</div>
                </div>
              </div>

              {deleteInfo.movimentos_count > 0 || deleteInfo.produtos_count > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  Não é possível excluir este local porque existem vínculos.
                </div>
              ) : (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  Esta ação não pode ser desfeita.
                </div>
              )}

              {(deleteInfo.produtos || []).length > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0B1220] overflow-hidden">
                  <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Exemplo de vínculos</div>
                    <div className="text-xs text-slate-400 mt-1">Produtos com saldo neste local</div>
                  </div>
                  <div className="divide-y divide-white/10">
                    {deleteInfo.produtos.slice(0, 12).map((p) => (
                      <div key={p.prod_id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-100 truncate" title={p.descricao}>
                            {p.descricao || p.prod_id}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{p.prod_id}</div>
                        </div>
                        <div className="text-sm font-mono font-semibold text-emerald-200">{formatQty(p.saldo)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Não foi possível carregar os vínculos deste local.</div>
          )}
        </div>
      </Modal>
    </div>
  )
}
