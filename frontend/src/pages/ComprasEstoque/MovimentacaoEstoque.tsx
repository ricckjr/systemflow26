import React, { useEffect, useMemo, useState } from 'react'
import { Box, Loader2 } from 'lucide-react'
import { api } from '@/services/api'
import { supabase } from '@/services/supabase'
import { fetchCrmProdutos, type CRM_Produto } from '@/services/crm'

type MovimentoTipo = 'Entrada' | 'Saida' | 'Ajuste' | 'Transferencia'

type LocalEstoque = {
  local_id: string
  nome: string
  ativo: boolean
}

const MOV_TIPOS: { key: MovimentoTipo; label: string }[] = [
  { key: 'Entrada', label: 'Entrada' },
  { key: 'Saida', label: 'Saída' },
  { key: 'Ajuste', label: 'Ajuste (diferença)' },
  { key: 'Transferencia', label: 'Transferência' }
]

const MOV_MOTIVOS: string[] = ['Ajuste por Inventário', 'Compra', 'Venda', 'Consumo', 'Outros']

const formatDateBR = (isoDate: string) => {
  const raw = String(isoDate || '').slice(0, 10)
  const [y, m, d] = raw.split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

export default function MovimentacaoEstoque() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [produtos, setProdutos] = useState<CRM_Produto[]>([])
  const [prodId, setProdId] = useState('')
  const [locais, setLocais] = useState<LocalEstoque[]>([])
  const locaisAtivos = useMemo(() => locais.filter((l) => l.ativo), [locais])

  const [tipo, setTipo] = useState<MovimentoTipo>('Entrada')
  const [dataMov, setDataMov] = useState(new Date().toISOString().slice(0, 10))
  const [quantidade, setQuantidade] = useState('')
  const [localOrigem, setLocalOrigem] = useState('')
  const [localDestino, setLocalDestino] = useState('')
  const [motivo, setMotivo] = useState(MOV_MOTIVOS[0] || 'Ajuste por Inventário')

  const [saldosByLocal, setSaldosByLocal] = useState<Record<string, number>>({})
  const [movimentos, setMovimentos] = useState<any[]>([])

  const produtoSelecionado = useMemo(() => produtos.find((p) => p.prod_id === prodId) || null, [produtos, prodId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: locaisData, error: locaisErr } = await (supabase as any)
          .from('crm_locais_estoque')
          .select('local_id,nome,ativo')
          .order('nome', { ascending: true })
        if (locaisErr) throw locaisErr
        if (!cancelled) {
          setLocais((locaisData || []) as LocalEstoque[])
          const first = (locaisData || []).find((l: any) => !!l?.ativo)?.nome || ''
          const second = (locaisData || []).find((l: any) => !!l?.ativo && l?.nome !== first)?.nome || ''
          setLocalOrigem((prev) => prev || first)
          setLocalDestino((prev) => prev || second)
        }

        const data = await fetchCrmProdutos()
        if (!cancelled) {
          setProdutos(data)
          if (!prodId && data[0]?.prod_id) setProdId(data[0].prod_id)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar produtos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshSaldoAndMovimentos = async (pId: string) => {
    if (!pId) return

    const { data: saldoRows, error: saldoErr } = await (supabase as any)
      .from('vw_saldo_produto')
      .select('local_estoque,saldo')
      .eq('prod_id', pId)

    if (saldoErr) throw saldoErr

    const saldos: Record<string, number> = {}
    for (const row of (saldoRows || []) as any[]) {
      const loc = String(row?.local_estoque || '').trim()
      if (!loc) continue
      saldos[loc] = Number(row?.saldo ?? 0)
    }
    setSaldosByLocal(saldos)

    const { data: movRows, error: movErr } = await (supabase as any)
      .from('crm_movimentacoes_estoque')
      .select('mov_id,tipo_movimentacao,data_movimentacao,quantidade,local_estoque,motivo,user_id')
      .eq('prod_id', pId)
      .order('data_movimentacao', { ascending: false })
      .limit(50)

    if (movErr) throw movErr
    setMovimentos((movRows || []) as any[])
  }

  useEffect(() => {
    setSuccess(null)
    setError(null)
    if (!prodId) return
    void refreshSaldoAndMovimentos(prodId)
  }, [prodId])

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!prodId) {
      setError('Selecione um produto.')
      return
    }
    const origem = String(localOrigem || '').trim()
    if (!origem) {
      setError('Selecione o local de estoque.')
      return
    }
    const destino = String(localDestino || '').trim()
    if (tipo === 'Transferencia' && !destino) {
      setError('Selecione o local de destino.')
      return
    }

    const qty = Number(String(quantidade).replace(',', '.'))
    if (!Number.isFinite(qty) || qty === 0) {
      setError('Informe uma quantidade válida.')
      return
    }
    if (tipo !== 'Ajuste' && qty < 0) {
      setError('A quantidade deve ser maior que zero.')
      return
    }
    if (tipo === 'Transferencia' && origem === destino) {
      setError('Para transferência, escolha locais diferentes.')
      return
    }

    setSaving(true)
    try {
      const result = await api.estoque.movimentar({
        prod_id: prodId,
        tipo_movimentacao: tipo,
        quantidade: qty,
        local_estoque: origem,
        local_estoque_destino: tipo === 'Transferencia' ? destino : null,
        motivo,
        data_movimentacao: dataMov
      })

      const count = Array.isArray(result?.movimentacoes) ? result.movimentacoes.length : 0
      setSuccess(count > 1 ? `Movimentação registrada (${count} lançamentos).` : 'Movimentação registrada.')
      setQuantidade('')
      await refreshSaldoAndMovimentos(prodId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao registrar movimentação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-4 pb-6 max-w-[1400px] mx-auto px-4 md:px-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
          <Box size={14} />
          Movimentação de Estoque
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Produto</label>
              <select
                value={prodId}
                onChange={(e) => setProdId(e.target.value)}
                className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
              >
                {produtos.map((p) => (
                  <option key={p.prod_id} value={p.prod_id}>
                    {p.codigo_prod ? `${p.codigo_prod} — ${p.descricao_prod}` : p.descricao_prod}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as MovimentoTipo)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                >
                  {MOV_TIPOS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Data</label>
                <input
                  type="date"
                  value={dataMov}
                  onChange={(e) => setDataMov(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">
                  Quantidade ({produtoSelecionado?.unidade_prod || 'UN'})
                </label>
                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all placeholder:text-slate-500 font-mono text-right"
                  placeholder="0"
                />
              </div>
              {tipo === 'Transferencia' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local Origem</label>
                    <select
                      value={localOrigem}
                      onChange={(e) => setLocalOrigem(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                      {locaisAtivos.map((l) => (
                        <option key={l.local_id} value={l.nome}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local Destino</label>
                    <select
                      value={localDestino}
                      onChange={(e) => setLocalDestino(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                    >
                      {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                      {locaisAtivos.map((l) => (
                        <option key={l.local_id} value={l.nome}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Local</label>
                  <select
                    value={localOrigem}
                    onChange={(e) => setLocalOrigem(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                  >
                    {locaisAtivos.length === 0 ? <option value="">Nenhum local cadastrado</option> : null}
                    {locaisAtivos.map((l) => (
                      <option key={l.local_id} value={l.nome}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wide ml-1">Motivo</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1220] border border-white/10 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/40 transition-all"
                >
                  {MOV_MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/15 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
            >
              {saving ? 'Salvando...' : 'Registrar Movimentação'}
            </button>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locaisAtivos.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#0B1220] p-4 text-xs text-slate-400">
                  Nenhum local de estoque cadastrado.
                </div>
              ) : (
                locaisAtivos.map((l) => (
                  <div key={l.local_id} className="rounded-xl border border-white/10 bg-[#0B1220] p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo</div>
                    <div className="mt-1 text-sm text-slate-300 truncate" title={l.nome}>
                      {l.nome}
                    </div>
                    <div className="mt-1 text-lg font-mono text-slate-100">{Number(saldosByLocal[l.nome] ?? 0).toLocaleString('pt-BR')}</div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1220] overflow-hidden">
              <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-slate-300">Histórico recente</div>
                <div className="text-xs text-slate-500">últimos 50</div>
              </div>
              <div className="overflow-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-white/5 border-b border-white/10">
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</div>
                    <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</div>
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Local</div>
                    <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</div>
                    <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo</div>
                  </div>
                  {movimentos.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-slate-400">Nenhuma movimentação encontrada.</div>
                  ) : (
                    movimentos.map((m) => (
                      <div key={m.mov_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
                        <div className="col-span-2 text-sm text-slate-100 font-mono">{formatDateBR(m.data_movimentacao)}</div>
                        <div className="col-span-3 text-sm text-slate-100">{m.tipo_movimentacao}</div>
                        <div className="col-span-2 text-sm text-slate-100">{m.local_estoque}</div>
                        <div className="col-span-2 text-sm text-slate-100 font-mono">{Number(m.quantidade ?? 0).toLocaleString('pt-BR')}</div>
                        <div className="col-span-3 text-sm text-slate-100 truncate" title={m.motivo || ''}>
                          {m.motivo || '-'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
