import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Loader2, Plus, Search } from 'lucide-react'
import { supabase } from '@/services/supabase'

type NcmItem = {
  ncm_id: string
  codigo: string
  descricao: string
  created_at: string
}

const PAGE_SIZE = 50

const formatCodigo = (codigo: string) => {
  const raw = String(codigo || '').trim()
  if (!raw) return '-'
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return raw
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

const toDigits8 = (input: string) => {
  const digits = String(input || '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  return digits
}

export default function CadastroNcm() {
  const [items, setItems] = useState<NcmItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')

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
        .select('ncm_id,codigo,descricao,created_at', { count: 'exact' })
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

  const handleCreate = async () => {
    const digits = toDigits8(novoCodigo)
    if (!digits) {
      setError('O código NCM deve ter 8 dígitos.')
      return
    }
    const codigo = formatCodigo(digits)
    const descricao = novaDescricao.trim()
    if (!descricao) {
      setError('Informe a descrição.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const payload = { ncm_id: digits, codigo, descricao }
      const { error: insError } = await (supabase as any).from('ncm').insert(payload)
      if (insError) throw insError
      setNovoCodigo('')
      setNovaDescricao('')
      await load()
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : ''
      if (code === '23505') {
        setError('Já existe um NCM com esse código.')
      } else {
        setError(e instanceof Error ? e.message : 'Falha ao cadastrar NCM')
      }
    } finally {
      setCreating(false)
    }
  }

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

        <div className="rounded-2xl border border-white/10 bg-[#0B1220]/40 p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Código NCM</div>
              <input
                value={novoCodigo}
                onChange={(e) => setNovoCodigo(e.target.value)}
                placeholder="1234.56.78"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              />
              <div className="mt-1 text-[10px] text-slate-500 font-mono">
                Sem máscara: {toDigits8(novoCodigo) ?? '-'}
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Descrição</div>
              <input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Descrição do NCM"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0B1220] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !toDigits8(novoCodigo) || !novaDescricao.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Cadastrar
              </button>
            </div>
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
                    <div className="text-xs text-slate-300 font-mono truncate">{i.ncm_id}</div>
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
