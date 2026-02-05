import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { fetchOportunidadeById, fetchOportunidadeItens } from '@/services/crm'
import { fetchFinCondicoesPagamento, fetchFinFormasPagamento } from '@/services/financeiro'

type DraftItem = {
  tipo: 'PRODUTO' | 'SERVICO'
  descricao: string
  quantidade: number
  descontoPercent: number
  valorUnitario: number
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

const calcItemTotal = (item: DraftItem) => {
  const qtd = Number(item.quantidade || 0)
  const unit = Number(item.valorUnitario || 0)
  const desc = Number(item.descontoPercent || 0)
  const factor = 1 - Math.min(100, Math.max(0, desc)) / 100
  const total = unit * qtd * factor
  return Number.isFinite(total) ? total : 0
}

export default function PropostaPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [opp, setOpp] = useState<any>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [formas, setFormas] = useState<any[]>([])
  const [condicoes, setCondicoes] = useState<any[]>([])

  const query = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const validadeParam = useMemo(() => String(query.get('validade') || '').trim() || null, [query])
  const tipoFreteParam = useMemo(() => String(query.get('tipoFrete') || '').trim() || null, [query])

  const formatDateBr = (value: string | null | undefined) => {
    const v = String(value || '').trim()
    if (!v) return '-'
    const dt = new Date(v)
    if (!Number.isFinite(dt.getTime())) return v
    return new Intl.DateTimeFormat('pt-BR').format(dt)
  }

  useEffect(() => {
    const oportunidadeId = String(id || '').trim()
    if (!oportunidadeId) return
    setLoading(true)
    setError(null)
    Promise.all([fetchOportunidadeById(oportunidadeId), fetchOportunidadeItens(oportunidadeId), fetchFinFormasPagamento(), fetchFinCondicoesPagamento()])
      .then(([o, its, f, c]) => {
        setOpp(o)
        setFormas(f || [])
        setCondicoes(c || [])
        const mapped = (its || []).map((r: any) => ({
          tipo: r.tipo,
          descricao: r.descricao_item || (r.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'),
          quantidade: Number(r.quantidade || 1) || 1,
          descontoPercent: Number(r.desconto_percent || 0) || 0,
          valorUnitario: Number(r.valor_unitario || 0) || 0
        })) as DraftItem[]
        setItems(mapped)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false))
  }, [id])

  const formaLabel = useMemo(() => {
    const formaId = String(opp?.forma_pagamento_id || '').trim()
    if (!formaId) return '-'
    const found = formas.find((x: any) => String(x.forma_id) === formaId)
    return String(found?.descricao || found?.codigo || '-')
  }, [opp, formas])

  const condicaoLabel = useMemo(() => {
    const condId = String(opp?.condicao_pagamento_id || '').trim()
    if (!condId) return '-'
    const found = condicoes.find((x: any) => String(x.condicao_id) === condId)
    return String(found?.descricao || found?.codigo || '-')
  }, [opp, condicoes])

  const descontoPropostaPercent = useMemo(() => {
    const v = Number(opp?.desconto_percent_proposta || 0)
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0
  }, [opp])

  const tipoFreteLabel = useMemo(() => {
    const v = (tipoFreteParam || String(opp?.tipo_frete || '')).trim().toUpperCase()
    if (!v) return '-'
    if (v === 'FOB') return 'FOB'
    if (v === 'CIF') return 'CIF'
    return v
  }, [opp, tipoFreteParam])

  const validadeLabel = useMemo(() => formatDateBr(validadeParam), [validadeParam])
  const previsaoEntregaLabel = useMemo(() => formatDateBr(String(opp?.prev_entrega || '').slice(0, 10)), [opp])

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + calcItemTotal(it), 0), [items])
  const total = useMemo(() => subtotal * (1 - descontoPropostaPercent / 100), [subtotal, descontoPropostaPercent])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      </div>
    )
  }

  if (!opp) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Proposta não encontrada.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-20 border-b border-white/10 bg-[#0B1220]/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-between items-center">
          <div className="text-sm font-bold text-slate-200 truncate">Preview da Proposta</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs font-black transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/30 text-white text-xs font-black transition-colors"
            >
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white text-slate-900 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Proposta Comercial</div>
                <div className="mt-2 text-2xl font-black text-slate-900 truncate">{String(opp?.cliente_nome || opp?.cliente || 'Cliente')}</div>
                <div className="mt-1 text-sm text-slate-600 truncate">{String(opp?.descricao_oport || '—')}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Código</div>
                <div className="mt-2 text-sm font-mono font-black text-slate-800">{String(opp?.cod_oport || opp?.cod_oportunidade || '-') || '-'}</div>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Contato</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{String(opp?.contato_nome || opp?.nome_contato || '-') || '-'}</div>
              <div className="mt-1 text-xs text-slate-600">{String(opp?.contato_email || opp?.email || '')}</div>
              <div className="mt-1 text-xs text-slate-600">{String(opp?.contato_telefone01 || opp?.telefone01_contato || '')}</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Pagamentos</div>
              <div className="mt-2 text-sm text-slate-800">
                <span className="font-black">Forma:</span> {formaLabel}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-black">Condição:</span> {condicaoLabel}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-black">Tipo:</span> {tipoFreteLabel}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-black">Desconto:</span> {descontoPropostaPercent}%
              </div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-black">Previsão de entrega:</span> {previsaoEntregaLabel}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                <span className="font-black">Validade:</span> {validadeLabel}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">Itens</div>
            <div className="mt-3 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-[860px] w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-widest text-slate-500 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4 text-right">Qtd</th>
                    <th className="py-3 px-4 text-right">Unit</th>
                    <th className="py-3 px-4 text-right">Desc %</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 px-4 text-slate-500">
                        Nenhum item adicionado.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={`${idx}-${it.descricao}`} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-bold">{it.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'}</td>
                        <td className="py-3 px-4">{it.descricao}</td>
                        <td className="py-3 px-4 text-right font-mono">{it.quantidade}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                        <td className="py-3 px-4 text-right font-mono">{it.descontoPercent}%</td>
                        <td className="py-3 px-4 text-right font-mono font-black">{formatCurrency(calcItemTotal(it))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-sm text-slate-700">
                  <div className="font-bold">Subtotal</div>
                  <div className="font-mono font-black">{formatCurrency(subtotal)}</div>
                </div>
                <div className="flex justify-between text-sm text-slate-700">
                  <div className="font-bold">Desconto</div>
                  <div className="font-mono font-black">{descontoPropostaPercent}%</div>
                </div>
                <div className="flex justify-between text-base text-slate-900 border-t border-slate-200 pt-2">
                  <div className="font-black">Total</div>
                  <div className="font-mono font-black">{formatCurrency(total)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
