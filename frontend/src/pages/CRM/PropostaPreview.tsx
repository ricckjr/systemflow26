import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { fetchOportunidadeById, fetchOportunidadeContatos, fetchOportunidadeItens } from '@/services/crm'
import {
  fetchFinCondicoesPagamento,
  fetchFinEmpresasCorrespondentes,
  fetchFinFormasPagamento,
  FinEmpresaCorrespondente,
  getFinEmpresaCorrespondenteLogoUrl
} from '@/services/financeiro'
import { supabase } from '@/services/supabase'
import { fetchContatoById } from '@/services/clienteContatos'
import { downloadPropostaPdf } from '@/utils/propostaPdf'

type DraftItem = {
  tipo: 'PRODUTO' | 'SERVICO'
  descricao: string
  quantidade: number
  descontoPercent: number
  valorUnitario: number
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
const formatNumber2 = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)

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
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [opp, setOpp] = useState<any>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [cliente, setCliente] = useState<any>(null)
  const [contato, setContato] = useState<any>(null)
  const [formas, setFormas] = useState<any[]>([])
  const [condicoes, setCondicoes] = useState<any[]>([])
  const [empresa, setEmpresa] = useState<FinEmpresaCorrespondente | null>(null)

  const query = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const validadeParam = useMemo(() => String(query.get('validade') || '').trim() || null, [query])
  const tipoFreteParam = useMemo(() => String(query.get('tipoFrete') || '').trim() || null, [query])
  const valoresParam = useMemo(() => String(query.get('valores') || '').trim(), [query])
  const pdfParam = useMemo(() => String(query.get('pdf') || '').trim(), [query])
  const showValores = useMemo(() => (valoresParam ? valoresParam !== '0' : true), [valoresParam])
  const autoPdf = useMemo(() => pdfParam === '1', [pdfParam])

  const TZ = 'America/Sao_Paulo'

  const formatDateBr = (value: string | null | undefined) => {
    const v = String(value || '').trim()
    if (!v) return '-'
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const dt = m?.[1] ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)) : new Date(v)
    if (!Number.isFinite(dt.getTime())) return v
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ }).format(dt)
  }

  const formatDateTimeBr = (value: string | null | undefined) => {
    const v = String(value || '').trim()
    if (!v) return '-'
    const dt = new Date(v)
    if (!Number.isFinite(dt.getTime())) return v
    const d = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ }).format(dt)
    const time = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(dt)
    return `${d} às ${time}`
  }

  useEffect(() => {
    const oportunidadeId = String(id || '').trim()
    if (!oportunidadeId) return
    setLoading(true)
    setError(null)
    let cancelled = false
    Promise.all([
      fetchOportunidadeById(oportunidadeId),
      fetchOportunidadeItens(oportunidadeId),
      fetchFinFormasPagamento(),
      fetchFinCondicoesPagamento(),
      fetchFinEmpresasCorrespondentes(),
      fetchOportunidadeContatos(oportunidadeId)
    ])
      .then(async ([o, its, f, c, empresas, contatoLinks]) => {
        if (cancelled) return
        setOpp(o)
        setFormas(f || [])
        setCondicoes(c || [])
        const empresaId = String((o as any)?.empresa_correspondente_id || '').trim()
        const empresaNomeRef = String((o as any)?.empresa_correspondente || '').trim() || 'Apliflow'
        const found =
          (empresaId ? (empresas || []).find((e) => String(e.empresa_id || '').trim() === empresaId) : null) ||
          (empresas || []).find((e) => String(e.nome_fantasia || '').trim().toLowerCase() === empresaNomeRef.toLowerCase()) ||
          (empresas || []).find((e) => String(e.razao_social || '').trim().toLowerCase() === empresaNomeRef.toLowerCase()) ||
          (empresas || []).find((e) => String(e.nome_fantasia || '').trim().toLowerCase() === 'apliflow') ||
          null
        setEmpresa(found)
        const mapped = (its || []).map((r: any) => ({
          tipo: r.tipo,
          descricao: r.descricao_item || (r.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'),
          quantidade: Number(r.quantidade || 1) || 1,
          descontoPercent: Number(r.desconto_percent || 0) || 0,
          valorUnitario: Number(r.valor_unitario || 0) || 0
        })) as DraftItem[]
        setItems(mapped)

        const clienteId = String((o as any)?.id_cliente || '').trim()
        if (clienteId) {
          const { data: cli, error: cliErr } = await (supabase as any)
            .from('crm_clientes')
            .select(
              `
              cliente_id,
              cliente_nome_razao_social,
              cliente_documento,
              cliente_documento_formatado,
              cliente_email,
              cliente_telefone,
              cliente_cep,
              cliente_endereco,
              cliente_numero,
              cliente_complemento,
              cliente_bairro,
              cliente_cidade,
              cliente_uf,
              deleted_at
            `
            )
            .eq('cliente_id', clienteId)
            .is('deleted_at', null)
            .maybeSingle()
          if (!cancelled && !cliErr) setCliente(cli)
        } else {
          setCliente(null)
        }

        const contatoIdRaw = String((o as any)?.id_contato || '').trim()
        const linkedPrincipalId =
          (contatoLinks || []).find((x: any) => !!x?.is_principal)?.contato_id || (contatoLinks || [])[0]?.contato_id || null
        const contatoId = contatoIdRaw || (linkedPrincipalId ? String(linkedPrincipalId).trim() : '')
        if (contatoId) {
          const ct = await fetchContatoById(contatoId)
          if (!cancelled) setContato(ct)
        } else {
          setContato(null)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
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

  const empresaNomeRef = useMemo(() => String(opp?.empresa_correspondente || '').trim() || 'Apliflow', [opp])

  const empresaNomeFantasia = useMemo(() => {
    const v = String(empresa?.nome_fantasia || empresaNomeRef).trim()
    return v || '—'
  }, [empresa, empresaNomeRef])

  const empresaRazaoSocial = useMemo(() => String(empresa?.razao_social || '').trim(), [empresa])
  void empresaRazaoSocial

  const empresaNome = useMemo(() => {
    const v = String(empresa?.razao_social || empresa?.nome_fantasia || empresaNomeRef).trim()
    return v || '—'
  }, [empresa, empresaNomeRef])

  const empresaLogoUrl = useMemo(() => getFinEmpresaCorrespondenteLogoUrl(empresa?.logo_path), [empresa])

  const empresaEnderecoLinha = useMemo(() => {
    const e = String(empresa?.endereco || '').trim()
    const b = String(empresa?.bairro || '').trim()
    return [e, b].filter(Boolean).join(' - ')
  }, [empresa])

  const empresaCidadeUfCep = useMemo(() => {
    const cidade = String(empresa?.cidade || '').trim()
    const uf = String(empresa?.uf || '').trim()
    const cep = String(empresa?.cep || '').trim()
    const left = [cidade, uf].filter(Boolean).join(' - ')
    const right = cep ? `CEP: ${cep}` : ''
    return [left, right].filter(Boolean).join(' - ')
  }, [empresa])

  const propostaCodigo = useMemo(() => String(opp?.cod_oport || opp?.cod_oportunidade || '-').trim() || '-', [opp])

  const clienteNome = useMemo(
    () => String(cliente?.cliente_nome_razao_social || opp?.cliente_nome || opp?.cliente || '—').trim() || '—',
    [cliente, opp]
  )
  const clienteDocumento = useMemo(() => {
    const v = String(cliente?.cliente_documento_formatado || cliente?.cliente_documento || opp?.cliente_documento || '').trim()
    return v || '-'
  }, [cliente, opp])
  const clienteDocumentoLabel = useMemo(() => {
    const digits = clienteDocumento.replace(/\D/g, '')
    if (digits.length === 11) return 'CPF'
    if (digits.length === 14) return 'CNPJ'
    return 'CPF/CNPJ'
  }, [clienteDocumento])
  const clienteEmail = useMemo(() => String(cliente?.cliente_email || '').trim(), [cliente])
  const clienteTelefone = useMemo(() => String(cliente?.cliente_telefone || '').trim(), [cliente])
  const clienteEndereco = useMemo(() => {
    const end = String(cliente?.cliente_endereco || '').trim()
    const num = String(cliente?.cliente_numero || '').trim()
    const comp = String(cliente?.cliente_complemento || '').trim()
    const parts = [end, num].filter(Boolean).join(', ')
    const full = [parts, comp].filter(Boolean).join(' ')
    return full.trim()
  }, [cliente])
  const clienteCidadeUfCep = useMemo(() => {
    const cidade = String(cliente?.cliente_cidade || '').trim()
    const uf = String(cliente?.cliente_uf || '').trim()
    const cep = String(cliente?.cliente_cep || '').trim()
    const left = [cidade, uf].filter(Boolean).join(' - ')
    const right = cep ? `CEP: ${cep}` : ''
    return [left, right].filter(Boolean).join(' - ')
  }, [cliente])
  const clienteEnderecoLinha = useMemo(() => {
    const parts = [clienteEndereco, clienteCidadeUfCep].filter(Boolean).join(' - ')
    return parts.trim()
  }, [clienteEndereco, clienteCidadeUfCep])

  const contatoNome = useMemo(() => String(contato?.contato_nome || opp?.contato_nome || opp?.nome_contato || '').trim(), [contato, opp])
  const contatoEmail = useMemo(() => String(contato?.contato_email || opp?.contato_email || opp?.email || '').trim(), [contato, opp])
  const contatoTelefone = useMemo(() => String(contato?.contato_telefone01 || opp?.contato_telefone01 || opp?.telefone01_contato || '').trim(), [contato, opp])

  const itensLabel = useMemo(() => {
    const tipos = new Set(items.map((i) => i.tipo))
    if (tipos.size === 1 && tipos.has('SERVICO')) return 'Lista dos Serviços'
    if (tipos.size === 1 && tipos.has('PRODUTO')) return 'Lista dos Produtos'
    return 'Lista de Itens'
  }, [items])

  const theme = useMemo(() => {
    const solucao = String(opp?.solucao || '').trim().toUpperCase()
    const tipos = new Set(items.map((i) => i.tipo))
    const inferred =
      solucao === 'PRODUTO' ? 'PRODUTO' : solucao === 'SERVICO' ? 'SERVICO' : tipos.size === 1 ? Array.from(tipos)[0] : null

    if (inferred === 'PRODUTO') {
      return {
        kind: 'PRODUTO' as const,
        label: 'Produto',
        primaryHex: '#F97316',
        lightHex: '#FFF7ED',
        rgb: [249, 115, 22] as [number, number, number],
        lightRgb: [255, 247, 237] as [number, number, number]
      }
    }
    if (inferred === 'SERVICO') {
      return {
        kind: 'SERVICO' as const,
        label: 'Serviço',
        primaryHex: '#2563EB',
        lightHex: '#EFF6FF',
        rgb: [37, 99, 235] as [number, number, number],
        lightRgb: [239, 246, 255] as [number, number, number]
      }
    }
    return {
      kind: 'OUTRO' as const,
      label: 'Proposta',
      primaryHex: '#0F172A',
      lightHex: '#F8FAFC',
      rgb: [15, 23, 42] as [number, number, number],
      lightRgb: [248, 250, 252] as [number, number, number]
    }
  }, [opp, items])

  const itensHeadLabel = useMemo(() => {
    if (theme.kind === 'PRODUTO') return 'Descrição do Produto'
    if (theme.kind === 'SERVICO') return 'Descrição do Serviço'
    return 'Descrição'
  }, [theme.kind])

  const emissaoLabel = useMemo(() => formatDateTimeBr(opp?.data_inclusao || opp?.criado_em || null), [opp])
  const vendedorLabel = useMemo(() => String(opp?.vendedor_nome || opp?.vendedor || '-').trim() || '-', [opp])
  const vencimentoLabel = useMemo(() => {
    const dt = new Date()
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ }).format(dt)
  }, [])

  const autoPdfTriggeredRef = useRef(false)
  useEffect(() => {
    if (!autoPdf) return
    if (loading) return
    if (!opp) return
    if (downloadingPdf) return
    if (autoPdfTriggeredRef.current) return
    autoPdfTriggeredRef.current = true
    void handleDownloadPdf()
  }, [autoPdf, loading, opp, downloadingPdf])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100">
        <div className="max-w-3xl mx-auto p-6">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800">{error}</div>
        </div>
      </div>
    )
  }

  if (!opp) {
    return (
      <div className="min-h-screen bg-neutral-100">
        <div className="max-w-3xl mx-auto p-6">
          <div className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800">Proposta não encontrada.</div>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1)
        return
      }
      if (window.opener) {
        window.close()
        return
      }
    } catch {
    }
    navigate('/app/crm/propostas-comerciais-kanban', { replace: true })
  }

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return
    if (!opp) return
    setDownloadingPdf(true)
    try {
      const oportunidadeId = String(id || '').trim()
      if (!oportunidadeId) throw new Error('ID da proposta inválido.')
      await downloadPropostaPdf({
        oportunidadeId,
        validade: validadeParam,
        tipoFrete: tipoFreteParam,
        showValores
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-200">
      <style>{`
        @page { size: A4; margin: 14mm; }
        html, body { height: auto; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          .sheet, .sheet * { visibility: visible !important; }
          .sheet { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-20 border-b border-neutral-300 bg-neutral-100/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-between items-center">
          <div className="text-sm font-bold text-neutral-800 truncate">Preview da Proposta</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-900 text-xs font-black transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-700/30 text-white text-xs font-black transition-colors"
            >
              {downloadingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="sheet bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.25)] mx-auto w-full max-w-[820px] rounded-sm">
          <div className="px-10 pt-8 pb-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-2">
                <img src={empresaLogoUrl || '/favicon-32x32.png'} alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <div className="flex-1 text-center">
                <div className="text-sm font-black tracking-wide">{empresaNomeFantasia}</div>
              </div>
              <div className="text-right text-[10px] leading-4">
                {empresa?.cnpj ? <div><span className="font-bold">CNPJ:</span> {empresa.cnpj}</div> : null}
                {empresa?.inscricao_estadual ? <div><span className="font-bold">Inscrição Estadual:</span> {empresa.inscricao_estadual}</div> : null}
                {empresa?.inscricao_municipal ? <div><span className="font-bold">Inscrição Municipal:</span> {empresa.inscricao_municipal}</div> : null}
                {empresaEnderecoLinha ? <div>{empresaEnderecoLinha}</div> : null}
                {empresaCidadeUfCep ? <div>{empresaCidadeUfCep}</div> : null}
                {empresa?.telefone ? <div>Telefone: {empresa.telefone}</div> : null}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <div className="flex items-center gap-2">
                  <div className="text-xl font-black">Proposta Comercial N° {propostaCodigo}</div>
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black"
                    style={{ borderColor: theme.primaryHex, color: theme.primaryHex, backgroundColor: theme.lightHex }}
                  >
                    {theme.label}
                  </span>
                </div>
                <div className="mt-4 text-sm font-black">Informações do Cliente</div>
                <div className="mt-3 text-[10px] leading-4">
                  <div className="font-black uppercase">{clienteNome}</div>
                  <div className="mt-2"><span className="font-bold">{clienteDocumentoLabel}:</span> {clienteDocumento}</div>
                  {clienteEnderecoLinha ? <div className="mt-2">{clienteEnderecoLinha}</div> : null}
                </div>
              </div>

              <div className="col-span-5 text-[10px] leading-4">
                <div className="font-black">Contato</div>
                <div className="mt-2">{contatoNome || '-'}</div>
                {contatoEmail ? <div>{contatoEmail}</div> : null}
                {contatoTelefone ? <div>{contatoTelefone}</div> : null}
              </div>
            </div>

            <div className="mt-8">
              <div className="text-sm font-black">{itensLabel}</div>
              <div className="mt-2 border border-neutral-300">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ backgroundColor: theme.primaryHex }}>
                      <th className="py-2 px-2 text-left text-white font-black">{itensHeadLabel}</th>
                      <th className="py-2 px-2 text-right text-white font-black w-[90px]">Quantidade</th>
                      {showValores ? (
                        <>
                          <th className="py-2 px-2 text-right text-white font-black w-[100px]">Valor Unit.</th>
                          <th className="py-2 px-2 text-right text-white font-black w-[100px]">Valor Total</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={showValores ? 4 : 2} className="py-4 px-2 text-neutral-700">Nenhum item adicionado.</td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={`${idx}-${it.descricao}`} style={{ backgroundColor: idx % 2 === 0 ? theme.lightHex : '#FFFFFF' }}>
                          <td className="py-2 px-2">{it.descricao}</td>
                          <td className="py-2 px-2 text-right">{formatNumber2(it.quantidade)}</td>
                          {showValores ? (
                            <>
                              <td className="py-2 px-2 text-right">{formatNumber2(it.valorUnitario)}</td>
                              <td className="py-2 px-2 text-right">{formatNumber2(calcItemTotal(it))}</td>
                            </>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {showValores ? (
                <div className="mt-2 flex justify-end text-[10px]">
                  <div className="w-[260px] space-y-1">
                    <div className="flex justify-between font-bold">
                      <div>Total:</div>
                      <div>{formatNumber2(total)}</div>
                    </div>
                    <div className="flex justify-between font-bold">
                      <div>Total do ISS:</div>
                      <div>{formatNumber2(0)}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-10 grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <div className="text-sm font-black">Vencimentos À Vista</div>
                <div className="mt-4 w-full max-w-[240px] border border-neutral-300">
                  <div className="grid grid-cols-2 text-[10px]">
                    <div className="font-bold px-2 py-2 border-b border-neutral-300" style={{ backgroundColor: theme.lightHex }}>Parcela</div>
                    <div className="px-2 py-2 border-b border-neutral-300 text-right" style={{ backgroundColor: theme.lightHex }}>1</div>
                    <div className="font-bold px-2 py-2 border-b border-neutral-300" style={{ backgroundColor: theme.lightHex }}>Vencimento</div>
                    <div className="px-2 py-2 border-b border-neutral-300 text-right" style={{ backgroundColor: theme.lightHex }}>{vencimentoLabel}</div>
                    <div className="font-bold px-2 py-2" style={{ backgroundColor: theme.lightHex }}>Valor</div>
                    <div className="px-2 py-2 text-right" style={{ backgroundColor: theme.lightHex }}>{showValores ? formatNumber2(total) : '-'}</div>
                  </div>
                </div>
              </div>

              <div className="col-span-7">
                <div className="text-sm font-black">Outras Informações</div>
                <div className="mt-4 text-[10px] leading-5">
                  <div><span className="font-bold">Proposta Comercial - incluído em:</span> {emissaoLabel}</div>
                  <div><span className="font-bold">Previsão de Faturamento:</span> {previsaoEntregaLabel}</div>
                  <div><span className="font-bold">Vendedor:</span> {vendedorLabel}</div>
                  <div className="mt-3"><span className="font-bold">FORMA DE PAGAMENTO:</span> {formaLabel}</div>
                  <div><span className="font-bold">FRETE:</span> {tipoFreteLabel}</div>
                  <div><span className="font-bold">CONDIÇÃO:</span> {condicaoLabel}</div>
                  <div><span className="font-bold">VALIDADE:</span> {validadeLabel}</div>
                  <div className="mt-3">
                    Esta proposta é válida até <span className="font-bold">{validadeLabel}</span>. Após essa data, os valores e condições comerciais poderão ser revisados.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 text-[9px] text-neutral-700">
              Proposta Comercial gerada pelo CRM a partir da oportunidade {clienteNome} - {String(opp?.solucao || '').replaceAll('_', ' ')} - {String(vendedorLabel)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
