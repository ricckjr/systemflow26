import React, { useEffect, useMemo, useState } from 'react'
import { Box, Loader2, Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '@/services/supabase'

type LocalEstoque = {
  local_id: string
  nome: string
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export default function LocaisEstoque() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LocalEstoque[]>([])

  const [search, setSearch] = useState('')
  const [novoNome, setNovoNome] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qError } = await (supabase as any)
        .from('crm_locais_estoque')
        .select('local_id,nome,ativo,criado_em,atualizado_em')
        .order('nome', { ascending: true })
      if (qError) throw qError
      setItems((data || []) as LocalEstoque[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar locais')
      setItems([])
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
              <div className="col-span-7 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Nome</div>
              <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Status</div>
              <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] text-right">Ação</div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {filtered.map((i) => (
                <div key={i.local_id} className="grid grid-cols-12 gap-3 px-4 py-3">
                  <div className="col-span-7 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate" title={i.nome}>
                      {i.nome}
                    </div>
                  </div>
                  <div className="col-span-3">
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
                  <div className="col-span-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggle(i)}
                      disabled={saving}
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
    </div>
  )
}

