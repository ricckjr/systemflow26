import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Loader2, Search } from 'lucide-react'
import { supabase } from '@/services/supabase'

type NcmItem = {
  ncm_id: string
  codigo: string
  descricao: string
  created_at: string
  cod_sem_mascara: number | null
}

const PAGE_SIZE = 50

const formatCodigo = (codigo: string) => {
  const raw = String(codigo || '').trim()
  if (!raw) return '-'
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return raw
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

export default function CadastroNcm() {
  const [items, setItems] = useState<NcmItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)

  const totalPages = useMemo(() => {
    if (!total) return 1
    return Math.max(1, Math.ceil(total / PAGE_SIZE))
  }, [total])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * PAGE_SIZE
      const term = search.trim()

      let query = supabase
        .from('ncm')
        .select('ncm_id,codigo,descricao,cod_sem_mascara,created_at', { count: 'exact' })
        .order('codigo', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (term) {
        const escaped = term.replace(/,/g, ' ')
        query = query.or(
          `codigo.ilike.%${escaped}%,descricao.ilike.%${escaped}%`
        )
      }

      const { data, error: qError, count } = await query
      if (qError) throw qError

      setItems((data || []) as NcmItem[])
      setTotal(typeof count === 'number' ? count : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar NCM')
      setItems([])
      setTotal(null)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search])

  return (
    <div className="pt-4 pb-6 max-w-[1600px] mx-auto px-4 md:px-6 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
        <Box size={14} />
        Compras e Estoque
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[var(--text)]">Cadastro NCM</h1>
            <p className="text-[13px] text-[var(--text-muted)]">
              Tabela de NCM para pesquisa e seleção por código/descrição.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
            />
          </div>

          <div className="shrink-0 text-xs text-[var(--text-muted)]">
            {typeof total === 'number' ? `${total.toLocaleString('pt-BR')} registros` : '-'}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-slate-500" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm font-semibold text-slate-200">Nenhum NCM encontrado</p>
            <p className="text-sm text-slate-400 mt-1">
              Se a base estiver vazia, rode o seed de NCM no backend para popular a tabela.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
              <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Código</div>
              <div className="col-span-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição</div>
              <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Sem Máscara</div>
            </div>
            <div className="divide-y divide-white/5">
              {items.map((i) => (
                <div
                  key={i.codigo}
                  className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#0B1220]/60 hover:bg-[#0B1220] transition-colors"
                >
                  <div className="col-span-2 min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate" title={i.codigo}>
                      {formatCodigo(i.codigo)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" title={i.codigo}>
                      {i.codigo}
                    </div>
                  </div>
                  <div className="col-span-8 min-w-0">
                    <div className="text-sm text-slate-200 truncate" title={i.descricao}>
                      {i.descricao}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <div className="text-xs text-slate-300 font-mono truncate">{i.cod_sem_mascara ?? '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            Anterior
          </button>
          <div className="text-xs text-[var(--text-muted)]">
            Página {page} de {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 rounded-xl text-slate-200 hover:bg-white/5 font-medium text-sm transition-colors border border-transparent hover:border-white/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  )
}
