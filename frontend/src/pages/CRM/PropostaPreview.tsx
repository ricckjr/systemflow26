import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { fetchOportunidadeById, fetchOportunidadeItens } from '@/services/crm'
import { fetchFinCondicoesPagamento, fetchFinFormasPagamento } from '@/services/financeiro'
import { supabase } from '@/services/supabase'
import { fetchContatoById } from '@/services/clienteContatos'

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

  const formatDateTimeBr = (value: string | null | undefined) => {
    const v = String(value || '').trim()
    if (!v) return '-'
    const dt = new Date(v)
    if (!Number.isFinite(dt.getTime())) return v
    const d = new Intl.DateTimeFormat('pt-BR').format(dt)
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    const ss = String(dt.getSeconds()).padStart(2, '0')
    return `${d} às ${hh}:${mm}:${ss}`
  }

  useEffect(() => {
    const oportunidadeId = String(id || '').trim()
    if (!oportunidadeId) return
    setLoading(true)
    setError(null)
    let cancelled = false
    Promise.all([fetchOportunidadeById(oportunidadeId), fetchOportunidadeItens(oportunidadeId), fetchFinFormasPagamento(), fetchFinCondicoesPagamento()])
      .then(async ([o, its, f, c]) => {
        if (cancelled) return
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

        const contatoId = String((o as any)?.id_contato || '').trim()
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

  const empresaNome = useMemo(() => {
    const raw = String(opp?.empresa_correspondente || 'Apliflow').trim().toUpperCase()
    if (raw === 'APLIFLOW') return 'APLIFLOW EQUIPAMENTOS INDUSTRIAIS LTDA'
    if (raw === 'AUTOMAFLOW') return 'AUTOMAFLOW'
    if (raw === 'TECNOTRON') return 'TECNOTRON'
    return raw || 'APLIFLOW EQUIPAMENTOS INDUSTRIAIS LTDA'
  }, [opp])

  const empresaInfo = useMemo(() => {
    const raw = String(opp?.empresa_correspondente || 'Apliflow').trim().toUpperCase()
    if (raw === 'AUTOMAFLOW') {
      return {
        site: 'www.automaflow.com.br',
        cnpj: '',
        ie: '',
        endereco: '',
        cidade: '',
        telefone: ''
      }
    }
    if (raw === 'TECNOTRON') {
      return {
        site: 'www.tecnotron.com.br',
        cnpj: '',
        ie: '',
        endereco: '',
        cidade: '',
        telefone: ''
      }
    }
    return {
      site: 'www.apliflow.com.br',
      cnpj: '22.202.421/0001-38',
      ie: '002.537.835/0093',
      endereco: 'RUA ARAPARI, 223',
      cidade: 'BELO HORIZONTE - MG - CEP: 31050-540',
      telefone: 'Telefone: (31) 3487-1600'
    }
  }, [opp])

  const propostaCodigo = useMemo(() => String(opp?.cod_oport || opp?.cod_oportunidade || '-').trim() || '-', [opp])

  const clienteNome = useMemo(
    () => String(cliente?.cliente_nome_razao_social || opp?.cliente_nome || opp?.cliente || '—').trim() || '—',
    [cliente, opp]
  )
  const clienteDocumento = useMemo(() => {
    const v = String(cliente?.cliente_documento_formatado || cliente?.cliente_documento || opp?.cliente_documento || '').trim()
    return v || '-'
  }, [cliente, opp])
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

  const contatoNome = useMemo(() => String(contato?.contato_nome || opp?.contato_nome || opp?.nome_contato || '').trim(), [contato, opp])
  const contatoEmail = useMemo(() => String(contato?.contato_email || opp?.contato_email || opp?.email || '').trim(), [contato, opp])
  const contatoTelefone = useMemo(() => String(contato?.contato_telefone01 || opp?.contato_telefone01 || opp?.telefone01_contato || '').trim(), [contato, opp])

  const itensLabel = useMemo(() => {
    const tipos = new Set(items.map((i) => i.tipo))
    if (tipos.size === 1 && tipos.has('SERVICO')) return 'Lista dos Serviços'
    if (tipos.size === 1 && tipos.has('PRODUTO')) return 'Lista dos Produtos'
    return 'Lista de Itens'
  }, [items])

  const emissaoLabel = useMemo(() => formatDateTimeBr(opp?.data_inclusao || opp?.criado_em || null), [opp])
  const vendedorLabel = useMemo(() => String(opp?.vendedor_nome || opp?.vendedor || '-').trim() || '-', [opp])
  const vencimentoLabel = useMemo(() => {
    const dt = new Date()
    return new Intl.DateTimeFormat('pt-BR').format(dt)
  }, [])

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
      const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const autoTable = (autoTableModule as any).default
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const left = 14
      const right = pageWidth - 14
      let y = 14

      const centerText = (txt: string, yy: number, size: number, bold?: boolean) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        doc.text(txt, pageWidth / 2, yy, { align: 'center' })
      }

      const textRight = (txt: string, xx: number, yy: number, size: number, bold?: boolean) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        doc.text(txt, xx, yy, { align: 'right' })
      }

      const textLeft = (txt: string, xx: number, yy: number, size: number, bold?: boolean) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        doc.text(txt, xx, yy)
      }

      doc.setDrawColor(0)
      doc.setLineWidth(0.2)

      textLeft('Apliflow', left, y + 2, 10, true)
      centerText(empresaNome, y, 10, true)
      centerText(empresaInfo.site, y + 4.5, 8, false)

      const empresaLines = [
        empresaInfo.cnpj ? `CNPJ: ${empresaInfo.cnpj}` : null,
        empresaInfo.ie ? `Inscrição Estadual: ${empresaInfo.ie}` : null,
        empresaInfo.endereco ? empresaInfo.endereco : null,
        empresaInfo.cidade ? empresaInfo.cidade : null,
        empresaInfo.telefone ? empresaInfo.telefone : null
      ].filter(Boolean) as string[]
      {
        let yy = y
        for (const line of empresaLines) {
          textRight(line, right, yy, 7.5, false)
          yy += 3.6
        }
      }

      y += 14
      doc.line(left, y, right, y)
      y += 8

      textLeft(`Proposta Comercial N° ${propostaCodigo}`, left, y, 14, true)
      y += 8
      textLeft('Informações do Cliente', left, y, 10, true)
      y += 6

      textLeft(clienteNome.toUpperCase(), left, y, 8.5, true)
      y += 4.5
      textLeft(`CNPJ: ${clienteDocumento}`, left, y, 8)
      y += 4.5
      if (clienteEndereco) {
        textLeft(clienteEndereco, left, y, 8)
        y += 4.5
      }
      if (clienteCidadeUfCep) {
        textLeft(clienteCidadeUfCep, left, y, 8)
        y += 4.5
      }
      if (clienteEmail) {
        textLeft(clienteEmail, left, y, 8)
        y += 4.5
      }
      if (clienteTelefone) {
        textLeft(`Telefone: ${clienteTelefone}`, left, y, 8)
        y += 4.5
      }

      const contatoBlockX = pageWidth * 0.6
      const contatoStartY = y - 22
      if (contatoStartY > 26) {
        textLeft('Contato', contatoBlockX, contatoStartY, 9, true)
        textLeft(contatoNome || '-', contatoBlockX, contatoStartY + 4.5, 8)
        if (contatoEmail) textLeft(contatoEmail, contatoBlockX, contatoStartY + 9, 8)
        if (contatoTelefone) textLeft(contatoTelefone, contatoBlockX, contatoStartY + 13.5, 8)
      }

      y += 6
      textLeft(itensLabel, left, y, 10, true)
      y += 3

      const rows = items.map((it) => [
        String(it.descricao || ''),
        formatNumber2(it.quantidade),
        formatNumber2(it.valorUnitario),
        formatNumber2(calcItemTotal(it))
      ])

      autoTable(doc, {
        startY: y,
        margin: { left, right },
        head: [['Descrição do Serviço', 'Quantidade', 'Valor Unit.', 'Valor Total']],
        body: rows.length ? rows : [['Nenhum item adicionado.', '', '', '']],
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, valign: 'middle' },
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [233, 251, 250] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right', cellWidth: 22 },
          2: { halign: 'right', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 25 }
        }
      })

      const finalY = (doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) : y + 10
      y = finalY + 6

      textRight('Total:', right - 25, y, 9, true)
      textRight(formatNumber2(total), right, y, 9, true)
      y += 4.5
      textRight('Total do ISS:', right - 25, y, 9, true)
      textRight(formatNumber2(0), right, y, 9, true)
      y += 10

      textLeft('Vencimentos À Vista', left, y, 10, true)
      y += 6
      const boxW = 70
      const boxH = 22
      doc.setDrawColor(180)
      doc.rect(left, y, boxW, boxH)
      doc.setFillColor(233, 251, 250)
      doc.rect(left, y, boxW, boxH, 'F')
      doc.setDrawColor(180)
      doc.rect(left, y, boxW, boxH)
      doc.line(left + boxW / 2, y, left + boxW / 2, y + boxH)
      doc.line(left, y + boxH / 3, left + boxW, y + boxH / 3)
      doc.line(left, y + (2 * boxH) / 3, left + boxW, y + (2 * boxH) / 3)
      textLeft('Parcela', left + 2, y + 5, 8, true)
      textRight('1', left + boxW - 2, y + 5, 8, false)
      textLeft('Vencimento', left + 2, y + 12, 8, true)
      textRight(vencimentoLabel, left + boxW - 2, y + 12, 8, false)
      textLeft('Valor', left + 2, y + 19, 8, true)
      textRight(formatNumber2(total), left + boxW - 2, y + 19, 8, false)

      const otherX = left + 90
      let otherY = y
      textLeft('Outras Informações', otherX, otherY, 10, true)
      otherY += 6
      textLeft(`Proposta Comercial - incluído em: ${emissaoLabel}`, otherX, otherY, 8)
      otherY += 4.5
      textLeft(`Previsão de Faturamento: ${previsaoEntregaLabel}`, otherX, otherY, 8)
      otherY += 4.5
      textLeft(`Vendedor: ${vendedorLabel}`, otherX, otherY, 8)
      otherY += 6
      textLeft(`FORMA DE PAGAMENTO: ${formaLabel}`, otherX, otherY, 8)
      otherY += 4.5
      textLeft(`FRETE: ${tipoFreteLabel}`, otherX, otherY, 8)
      otherY += 4.5
      textLeft(`CONDIÇÃO: ${condicaoLabel}`, otherX, otherY, 8)
      otherY += 4.5
      textLeft(`VALIDADE: ${validadeLabel}`, otherX, otherY, 8)

      const filename = `Proposta-${propostaCodigo}`.replaceAll('/', '-').replaceAll('\\', '-').replaceAll(':', '-')
      doc.save(`${filename}.pdf`)
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
                <img src="/favicon-32x32.png" alt="Logo" className="w-7 h-7" />
              </div>
              <div className="flex-1 text-center">
                <div className="text-sm font-black tracking-wide">{empresaNome}</div>
                <div className="text-[10px] font-semibold">{empresaInfo.site}</div>
              </div>
              <div className="text-right text-[10px] leading-4">
                {empresaInfo.cnpj ? <div><span className="font-bold">CNPJ:</span> {empresaInfo.cnpj}</div> : null}
                {empresaInfo.ie ? <div><span className="font-bold">Inscrição Estadual:</span> {empresaInfo.ie}</div> : null}
                {empresaInfo.endereco ? <div>{empresaInfo.endereco}</div> : null}
                {empresaInfo.cidade ? <div>{empresaInfo.cidade}</div> : null}
                {empresaInfo.telefone ? <div>{empresaInfo.telefone}</div> : null}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <div className="text-xl font-black">Proposta Comercial N° {propostaCodigo}</div>
                <div className="mt-4 text-sm font-black">Informações do Cliente</div>
                <div className="mt-3 text-[10px] leading-4">
                  <div className="font-black uppercase">{clienteNome}</div>
                  <div className="mt-2"><span className="font-bold">CNPJ:</span> {clienteDocumento}</div>
                  {clienteEndereco ? <div className="mt-2">{clienteEndereco}</div> : null}
                  {clienteCidadeUfCep ? <div>{clienteCidadeUfCep}</div> : null}
                  {clienteEmail ? <div className="mt-2">{clienteEmail}</div> : null}
                  {clienteTelefone ? <div>Telefone: {clienteTelefone}</div> : null}
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
                    <tr style={{ backgroundColor: '#14B8A6' }}>
                      <th className="py-2 px-2 text-left text-white font-black">Descrição do Serviço</th>
                      <th className="py-2 px-2 text-right text-white font-black w-[90px]">Quantidade</th>
                      <th className="py-2 px-2 text-right text-white font-black w-[100px]">Valor Unit.</th>
                      <th className="py-2 px-2 text-right text-white font-black w-[100px]">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 px-2 text-neutral-700">Nenhum item adicionado.</td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={`${idx}-${it.descricao}`} className={idx % 2 === 0 ? 'bg-[#E9FBFA]' : 'bg-white'}>
                          <td className="py-2 px-2">{it.descricao}</td>
                          <td className="py-2 px-2 text-right">{formatNumber2(it.quantidade)}</td>
                          <td className="py-2 px-2 text-right">{formatNumber2(it.valorUnitario)}</td>
                          <td className="py-2 px-2 text-right">{formatNumber2(calcItemTotal(it))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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
            </div>

            <div className="mt-10 grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <div className="text-sm font-black">Vencimentos À Vista</div>
                <div className="mt-4 w-full max-w-[240px] border border-neutral-300">
                  <div className="grid grid-cols-2 text-[10px]">
                    <div className="bg-[#E9FBFA] font-bold px-2 py-2 border-b border-neutral-300">Parcela</div>
                    <div className="bg-[#E9FBFA] px-2 py-2 border-b border-neutral-300 text-right">1</div>
                    <div className="bg-[#E9FBFA] font-bold px-2 py-2 border-b border-neutral-300">Vencimento</div>
                    <div className="bg-[#E9FBFA] px-2 py-2 border-b border-neutral-300 text-right">{vencimentoLabel}</div>
                    <div className="bg-[#E9FBFA] font-bold px-2 py-2">Valor</div>
                    <div className="bg-[#E9FBFA] px-2 py-2 text-right">{formatNumber2(total)}</div>
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
