import { supabase } from '@/services/supabase'
import { fetchOportunidadeById, fetchOportunidadeContatos, fetchOportunidadeItens } from '@/services/crm'
import { fetchContatoById } from '@/services/clienteContatos'
import {
  fetchFinCondicoesPagamento,
  fetchFinEmpresasCorrespondentes,
  fetchFinFormasPagamento,
  getFinEmpresaCorrespondenteLogoUrl
} from '@/services/financeiro'

type JsPdfDeps = {
  jsPDF: any
  autoTable: any
}

let depsPromise: Promise<JsPdfDeps> | null = null
let finCachePromise: Promise<{ formas: any[]; condicoes: any[]; empresas: any[] }> | null = null
const logoDataUrlCache = new Map<string, string>()
const vendedorProfileCache = new Map<string, { email: string }>()

export function preloadPropostaPdfDeps() {
  depsPromise =
    depsPromise ??
    Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([jspdf, autotable]) => ({
      jsPDF: (jspdf as any).jsPDF,
      autoTable: (autotable as any).default
    }))
  return depsPromise
}

async function fetchFinCache() {
  finCachePromise =
    finCachePromise ??
    Promise.all([fetchFinFormasPagamento(), fetchFinCondicoesPagamento(), fetchFinEmpresasCorrespondentes()]).then(
      ([formas, condicoes, empresas]) => ({
        formas: formas || [],
        condicoes: condicoes || [],
        empresas: empresas || []
      })
    )
  return finCachePromise
}

const formatNumber2 = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
const formatCurrencyBr = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

const calcItemTotal = (item: { quantidade: number; valorUnitario: number; descontoPercent: number }) => {
  const qtd = Number(item.quantidade || 0)
  const unit = Number(item.valorUnitario || 0)
  const desc = Number(item.descontoPercent || 0)
  const factor = 1 - Math.min(100, Math.max(0, desc)) / 100
  const total = unit * qtd * factor
  return Number.isFinite(total) ? total : 0
}

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

type PropostaPdfOptions = {
  oportunidadeId: string
  validade: string | null
  tipoFrete: string | null
  showValores: boolean
}

async function buildPropostaPdfBlob(opts: PropostaPdfOptions) {
  const oportunidadeId = String(opts.oportunidadeId || '').trim()
  if (!oportunidadeId) throw new Error('ID da proposta inválido.')

  const validade = String(opts.validade || '').trim()
  const tipoFrete = String(opts.tipoFrete || '').trim()
  const showValores = !!opts.showValores

  const [{ jsPDF, autoTable }, opp, its, fin, contatoLinks] = await Promise.all([
    preloadPropostaPdfDeps(),
    fetchOportunidadeById(oportunidadeId),
    fetchOportunidadeItens(oportunidadeId),
    fetchFinCache(),
    fetchOportunidadeContatos(oportunidadeId)
  ])

  if (!opp) throw new Error('Proposta não encontrada.')

  const formas = fin.formas
  const condicoes = fin.condicoes
  const empresas = fin.empresas

  const empresaId = String((opp as any)?.empresa_correspondente_id || '').trim()
  const empresaNomeRef = String((opp as any)?.empresa_correspondente || '').trim() || 'Apliflow'
  const empresa =
    (empresaId ? (empresas || []).find((e: any) => String(e.empresa_id || '').trim() === empresaId) : null) ||
    (empresas || []).find((e: any) => String(e.nome_fantasia || '').trim().toLowerCase() === empresaNomeRef.toLowerCase()) ||
    (empresas || []).find((e: any) => String(e.razao_social || '').trim().toLowerCase() === empresaNomeRef.toLowerCase()) ||
    (empresas || []).find((e: any) => String(e.nome_fantasia || '').trim().toLowerCase() === 'apliflow') ||
    null

  const items = (its || []).map((r: any) => ({
    tipo: r.tipo as 'PRODUTO' | 'SERVICO',
    descricao: r.descricao_item || (r.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'),
    quantidade: Number(r.quantidade || 1) || 1,
    descontoPercent: Number(r.desconto_percent || 0) || 0,
    valorUnitario: Number(r.valor_unitario || 0) || 0
  }))

  const solucao = String((opp as any)?.solucao || '').trim().toUpperCase()
  const tipos = new Set(items.map((i) => i.tipo))
  const inferred = solucao === 'PRODUTO' ? 'PRODUTO' : solucao === 'SERVICO' ? 'SERVICO' : tipos.size === 1 ? Array.from(tipos)[0] : null
  const theme =
    inferred === 'PRODUTO'
      ? { primaryHex: '#F97316', lightRgb: [255, 247, 237] as [number, number, number], rgb: [249, 115, 22] as [number, number, number] }
      : inferred === 'SERVICO'
        ? { primaryHex: '#2563EB', lightRgb: [239, 246, 255] as [number, number, number], rgb: [37, 99, 235] as [number, number, number] }
        : { primaryHex: '#0F172A', lightRgb: [248, 250, 252] as [number, number, number], rgb: [15, 23, 42] as [number, number, number] }

  const itensHeadLabel = inferred === 'PRODUTO' ? 'Descrição do Produto' : inferred === 'SERVICO' ? 'Descrição do Serviço' : 'Descrição'

  const clienteId = String((opp as any)?.id_cliente || '').trim()
  let cliente: any = null
  const shouldFetchCliente = clienteId && !String((opp as any)?.cliente_documento || '').trim()
  if (shouldFetchCliente) {
    try {
      const { data, error } = await (supabase as any)
        .from('crm_clientes')
        .select(
          'cliente_id, cliente_nome_razao_social, cliente_documento, cliente_documento_formatado, cliente_endereco, cliente_numero, cliente_complemento, cliente_cidade, cliente_uf, cliente_cep, deleted_at'
        )
        .eq('cliente_id', clienteId)
        .maybeSingle()
      if (!error && data && !(data as any).deleted_at) cliente = data
    } catch {}
  }

  const contatoIdRaw = String((opp as any)?.id_contato || '').trim()
  const linkedPrincipalId =
    (contatoLinks || []).find((x: any) => !!x?.is_principal)?.contato_id || (contatoLinks || [])[0]?.contato_id || null
  const contatoId = contatoIdRaw || (linkedPrincipalId ? String(linkedPrincipalId).trim() : '')
  const contato = contatoId ? await fetchContatoById(contatoId) : null

  const propostaCodigo = String((opp as any)?.cod_oport || (opp as any)?.cod_oportunidade || '-').trim() || '-'
  const clienteNome = String(cliente?.cliente_nome_razao_social || (opp as any)?.cliente_nome || (opp as any)?.cliente || '—').trim() || '—'
  const clienteDocumento = String(cliente?.cliente_documento_formatado || cliente?.cliente_documento || (opp as any)?.cliente_documento || '').trim() || '-'
  const docDigits = clienteDocumento.replace(/\D/g, '')
  const clienteDocumentoLabel = docDigits.length === 11 ? 'CPF' : docDigits.length === 14 ? 'CNPJ' : 'CPF/CNPJ'

  const clienteEndereco = String(cliente?.cliente_endereco || '').trim()
  const clienteNumero = String(cliente?.cliente_numero || '').trim()
  const clienteComplemento = String(cliente?.cliente_complemento || '').trim()
  const clienteCidade = String(cliente?.cliente_cidade || '').trim()
  const clienteUf = String(cliente?.cliente_uf || '').trim()
  const clienteCep = String(cliente?.cliente_cep || '').trim()
  const endParts = [clienteEndereco, clienteNumero].filter(Boolean).join(', ')
  const endFull = [endParts, clienteComplemento].filter(Boolean).join(' ').trim()
  const cidadeUf = [clienteCidade, clienteUf].filter(Boolean).join(' - ')
  const cidadeUfCep = [cidadeUf, clienteCep ? `CEP: ${clienteCep}` : ''].filter(Boolean).join(' - ')
  const clienteEnderecoLinha = [endFull, cidadeUfCep].filter(Boolean).join(' - ').trim()

  const contatoNome = String((contato as any)?.contato_nome || (opp as any)?.contato_nome || (opp as any)?.nome_contato || '').trim() || '-'
  const contatoEmail = String((contato as any)?.contato_email || (opp as any)?.contato_email || (opp as any)?.email || '').trim()
  const contatoTelefone = String((contato as any)?.contato_telefone01 || (opp as any)?.contato_telefone01 || (opp as any)?.telefone01_contato || '').trim()

  const formaId = String((opp as any)?.forma_pagamento_id || '').trim()
  const formaLabel = formaId ? String((formas || []).find((x: any) => String(x.forma_id) === formaId)?.descricao || (formas || []).find((x: any) => String(x.forma_id) === formaId)?.codigo || '-') : '-'

  const condId = String((opp as any)?.condicao_pagamento_id || '').trim()
  const condicaoLabel = condId
    ? String((condicoes || []).find((x: any) => String(x.condicao_id) === condId)?.descricao || (condicoes || []).find((x: any) => String(x.condicao_id) === condId)?.codigo || '-')
    : '-'

  const descontoPropostaPercent = (() => {
    const v = Number((opp as any)?.desconto_percent_proposta || 0)
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0
  })()

  const subtotal = items.reduce((acc, it) => acc + calcItemTotal(it), 0)
  const total = subtotal * (1 - descontoPropostaPercent / 100)

  const emissaoLabel = formatDateTimeBr((opp as any)?.data_inclusao || (opp as any)?.criado_em || null)
  const previsaoFaturamentoLabel = formatDateBr(String((opp as any)?.prev_entrega || '').slice(0, 10))
  const vendedorLabel = String((opp as any)?.vendedor_nome || (opp as any)?.vendedor || '-').trim() || '-'
  const vendedorId = String((opp as any)?.id_vendedor || '').trim()
  let vendedorEmail = ''
  if (vendedorId) {
    const cached = vendedorProfileCache.get(vendedorId)
    if (cached) {
      vendedorEmail = cached.email
    } else {
      try {
        const { data } = await (supabase as any)
          .from('profiles')
          .select('email_corporativo, email_login')
          .eq('id', vendedorId)
          .maybeSingle()
        const email = String((data as any)?.email_corporativo || (data as any)?.email_login || '').trim()
        vendedorProfileCache.set(vendedorId, { email })
        vendedorEmail = email
      } catch {
        vendedorProfileCache.set(vendedorId, { email: '' })
      }
    }
  }
  const validadeLabel = formatDateBr(validade || null)
  const tipoFreteLabel = (() => {
    const v = (tipoFrete || String((opp as any)?.tipo_frete || '')).trim().toUpperCase()
    if (!v) return '-'
    if (v === 'FOB') return 'FOB'
    if (v === 'CIF') return 'CIF'
    return v
  })()

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 14
  const right = pageWidth - 14
  const maxContentWidth = right - left

  const empresaNomeFantasia = String((empresa as any)?.nome_fantasia || (empresa as any)?.razao_social || empresaNomeRef).trim() || '—'
  const empresaCnpj = String((empresa as any)?.cnpj || '').trim()
  const empresaTelefone = String((empresa as any)?.telefone || '').trim()
  const empresaCidadeUf = [String((empresa as any)?.cidade || '').trim(), String((empresa as any)?.uf || '').trim()].filter(Boolean).join(' - ')

  const logoUrl = getFinEmpresaCorrespondenteLogoUrl((empresa as any)?.logo_path)
  const toDataUrl = async (url: string) => {
    const u = String(url || '').trim()
    if (!u) return ''
    const cached = logoDataUrlCache.get(u)
    if (cached !== undefined) return cached
    try {
      const res = await fetch(u)
      if (!res.ok) {
        logoDataUrlCache.set(u, '')
        return ''
      }
      const blob = await res.blob()
      const mime = String(blob.type || '')
      if (!mime.startsWith('image/')) {
        logoDataUrlCache.set(u, '')
        return ''
      }
      if (mime === 'image/webp') {
        logoDataUrlCache.set(u, '')
        return ''
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Falha ao ler imagem.'))
        reader.onload = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(blob)
      })
      logoDataUrlCache.set(u, dataUrl)
      return dataUrl
    } catch {
      logoDataUrlCache.set(u, '')
      return ''
    }
  }

  const logoDataUrl = await toDataUrl(logoUrl)

  const headerLineY = 36
  const marginTop = headerLineY + 10
  const marginBottom = 14
  let y = marginTop

  const centerText = (txt: string, yy: number, size: number, bold?: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(txt, pageWidth / 2, yy, { align: 'center' })
  }

  const wrapCenter = (txt: string, yy: number, maxWidth: number, size: number, bold?: boolean, lineH = 3.8) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(String(txt || ''), maxWidth) as string[]
    let y0 = yy
    for (const line of lines) {
      doc.text(line, pageWidth / 2, y0, { align: 'center' })
      y0 += lineH
    }
    return y0
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

  const wrapLeft = (txt: string, xx: number, yy: number, maxWidth: number, size: number, bold?: boolean, lineH = 3.8) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(String(txt || ''), maxWidth) as string[]
    let y0 = yy
    for (const line of lines) {
      doc.text(line, xx, y0)
      y0 += lineH
    }
    return y0
  }

  const wrapRight = (txt: string, xx: number, yy: number, maxWidth: number, size: number, bold?: boolean, lineH = 3.4) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(String(txt || ''), maxWidth) as string[]
    let y0 = yy
    for (const line of lines) {
      doc.text(line, xx, y0, { align: 'right' })
      y0 += lineH
    }
    return y0
  }

  const drawHeader = () => {
    doc.setDrawColor(160)
    doc.setLineWidth(0.2)

    let hasLogo = false
    if (logoDataUrl) {
      const mime = logoDataUrl.startsWith('data:') ? logoDataUrl.slice(5, logoDataUrl.indexOf(';')) : ''
      const fmt = mime.includes('png') ? 'PNG' : mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : ''
      if (fmt) {
        doc.addImage(logoDataUrl, fmt as any, left, 10, 18, 18)
        hasLogo = true
      }
    }

    const empresaRazaoSocial = String((empresa as any)?.razao_social || '').trim()
    const empresaNomeFantasiaLocal = String((empresa as any)?.nome_fantasia || '').trim()
    const empresaNomeCentro = (empresaRazaoSocial || empresaNomeFantasiaLocal || empresaNomeRef || '—').trim() || '—'
    const empresaSub = empresaRazaoSocial && empresaNomeFantasiaLocal && empresaRazaoSocial !== empresaNomeFantasiaLocal ? empresaNomeFantasiaLocal : ''

    centerText(empresaNomeCentro.toUpperCase(), 16, 11, true)
    if (empresaSub) centerText(empresaSub, 21, 8.5, false)

    const empresaEnderecoLinha = [String((empresa as any)?.endereco || '').trim(), String((empresa as any)?.bairro || '').trim()].filter(Boolean).join(' - ')
    const empresaCidadeUfCep = [
      [String((empresa as any)?.cidade || '').trim(), String((empresa as any)?.uf || '').trim()].filter(Boolean).join(' - '),
      String((empresa as any)?.cep || '').trim() ? `CEP: ${String((empresa as any)?.cep || '').trim()}` : ''
    ]
      .filter(Boolean)
      .join(' - ')

    const empresaLines = [
      String((empresa as any)?.cnpj || '').trim() ? `CNPJ: ${String((empresa as any)?.cnpj || '').trim()}` : null,
      String((empresa as any)?.inscricao_estadual || '').trim() ? `Inscrição Estadual: ${String((empresa as any)?.inscricao_estadual || '').trim()}` : null,
      String((empresa as any)?.inscricao_municipal || '').trim() ? `Inscrição Municipal: ${String((empresa as any)?.inscricao_municipal || '').trim()}` : null,
      empresaEnderecoLinha ? empresaEnderecoLinha : null,
      empresaCidadeUfCep ? empresaCidadeUfCep : null,
      String((empresa as any)?.telefone || '').trim() ? `Telefone: ${String((empresa as any)?.telefone || '').trim()}` : null
    ].filter(Boolean) as string[]

    {
      let yy = 12
      for (const line of empresaLines) {
        yy = wrapRight(line, right, yy, 82, 7.2, false, 3.4)
      }
    }

    if (hasLogo) {
      doc.setDrawColor(220)
      doc.rect(left, 10, 18, 18)
      doc.setDrawColor(160)
    }

    doc.line(left, headerLineY, right, headerLineY)
  }

  const drawFooter = (pageNumber: number, pageCount: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.setTextColor(0)
  }

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - marginBottom) return
    doc.addPage()
    drawHeader()
    y = marginTop
  }

  drawHeader()
  y = marginTop

  textLeft(`Proposta Comercial N° ${propostaCodigo}`, left, y, 14, true)
  y += 8

  textLeft('Informações do Cliente', left, y, 10, true)
  y += 6

  y = wrapLeft(clienteNome.toUpperCase(), left, y, 110, 8.5, true, 4.2)
  y = wrapLeft(`CNPJ/CPF: ${clienteDocumento}`, left, y, 110, 8, false, 4.2)
  if (clienteEnderecoLinha) {
    y = wrapLeft(`Endereço: ${clienteEnderecoLinha}`, left, y, 110, 8, false, 4.2)
  }

  const contatoBlockX = left + 120
  const contatoStartY = y - 12.6
  if (contatoStartY > marginTop - 6) {
    textLeft('Contato', contatoBlockX, contatoStartY, 9, true)
    wrapLeft(contatoNome || '-', contatoBlockX, contatoStartY + 4.5, right - contatoBlockX, 8, false, 4.2)
    if (contatoEmail) wrapLeft(contatoEmail, contatoBlockX, contatoStartY + 8.7, right - contatoBlockX, 8, false, 4.2)
    if (contatoTelefone) wrapLeft(contatoTelefone, contatoBlockX, contatoStartY + 12.9, right - contatoBlockX, 8, false, 4.2)
  }

  y += 6
  const itensLabel = inferred === 'SERVICO' ? 'Lista dos Serviços' : inferred === 'PRODUTO' ? 'Lista dos Produtos' : 'Lista de Itens'
  textLeft(itensLabel, left, y, 10, true)
  y += 3

  const rows = items.map((it) => [
    String(it.descricao || ''),
    formatNumber2(it.quantidade),
    showValores ? formatCurrencyBr(it.valorUnitario) : '',
    showValores ? formatCurrencyBr(calcItemTotal(it)) : ''
  ])

  const head = showValores ? [itensHeadLabel, 'Quantidade', 'Valor Unit.', 'Valor Total'] : [itensHeadLabel, 'Quantidade']
  const body = rows.length
    ? rows.map((r) => (showValores ? r : [r[0], r[1]]))
    : [showValores ? ['Nenhum item adicionado.', '', '', ''] : ['Nenhum item adicionado.', '']]

  const tableW = maxContentWidth
  const descW = showValores ? Math.max(60, tableW - (22 + 25 + 25)) : Math.max(60, tableW - 22)

  autoTable(doc, {
    startY: y,
    margin: { top: marginTop, left, right },
    tableWidth: tableW,
    head: [head],
    body,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: theme.rgb, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: theme.lightRgb },
    didDrawPage: () => {
      drawHeader()
    },
    columnStyles: showValores
      ? {
          0: { cellWidth: descW },
          1: { halign: 'right', cellWidth: 22 },
          2: { halign: 'right', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 25 }
        }
      : {
          0: { cellWidth: descW },
          1: { halign: 'right', cellWidth: 22 }
        }
  })

  y = ((doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) : y + 10) + 6

  if (showValores) {
    textRight('Total:', right - 35, y, 9, true)
    textRight(formatCurrencyBr(total), right, y, 9, true)
    y += 4.5
    textRight('Total do ISS:', right - 35, y, 9, true)
    textRight(formatCurrencyBr(0), right, y, 9, true)
    y += 10
  }

  ensureSpace(60)
  textLeft('Pagamentos e Vencimentos', left, y, 10, true)
  y += 6
  y = wrapLeft(`Forma: ${formaLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Condição: ${condicaoLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Desconto: ${formatNumber2(descontoPropostaPercent)}%`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Frete: ${tipoFreteLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Previsão de Faturamento: ${previsaoFaturamentoLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y += 6

  textLeft('Vencimentos À Vista', left, y, 10, true)
  y += 6
  const boxW = 70
  const boxH = 22
  doc.setDrawColor(180)
  doc.rect(left, y, boxW, boxH)
  doc.setFillColor(theme.lightRgb[0], theme.lightRgb[1], theme.lightRgb[2])
  doc.rect(left, y, boxW, boxH, 'F')
  doc.setDrawColor(180)
  doc.rect(left, y, boxW, boxH)
  doc.line(left + boxW / 2, y, left + boxW / 2, y + boxH)
  doc.line(left, y + boxH / 3, left + boxW, y + boxH / 3)
  doc.line(left, y + (2 * boxH) / 3, left + boxW, y + (2 * boxH) / 3)
  textLeft('Parcela', left + 2, y + 5, 8, true)
  textRight('1', left + boxW - 2, y + 5, 8, false)
  textLeft('Vencimento', left + 2, y + 12, 8, true)
  textRight('À vista', left + boxW - 2, y + 12, 8, false)
  textLeft('Valor', left + 2, y + 19, 8, true)
  textRight(showValores ? formatCurrencyBr(total) : '-', left + boxW - 2, y + 19, 8, false)
  y += boxH + 10

  ensureSpace(45)
  textLeft('Outras Informações', left, y, 10, true)
  y += 6
  y = wrapLeft(`Proposta Comercial: ${emissaoLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Vendedor: ${vendedorLabel}`, left, y, maxContentWidth, 8, false, 4.2)
  y = wrapLeft(`Email Vendedor: ${vendedorEmail || '-'}`, left, y, maxContentWidth, 8, false, 4.2)
  y += 6

  const solucaoTexto =
    inferred === 'PRODUTO' ? 'fornecimento de produto' : inferred === 'SERVICO' ? 'prestação de serviço' : 'fornecimento de produto ou prestação de serviço'
  const paragrafo = `Esta proposta comercial foi gerada automaticamente pelo sistema CRM, com base na oportunidade vinculada ao cliente '${clienteNome}', referente à solução '${solucaoTexto}', elaborada pelo usuário '${vendedorLabel}' em '${emissaoLabel}'. O presente documento possui validade até '${validadeLabel}'. Após este prazo, os valores e as condições comerciais estarão sujeitos à reavaliação.`
  wrapLeft(paragrafo, left, y, maxContentWidth, 7.4, false, 3.8)

  const filenameBase = `Proposta-${propostaCodigo}`.replaceAll('/', '-').replaceAll('\\', '-').replaceAll(':', '-')
  const filename = `${filenameBase}.pdf`
  const pageCount = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : (doc as any).internal.pages?.length - 1
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    drawFooter(i, pageCount)
  }
  const blob = doc.output('blob') as Blob
  return { blob, filename }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function downloadPropostaPdf(opts: PropostaPdfOptions) {
  const { blob, filename } = await buildPropostaPdfBlob(opts)
  triggerBrowserDownload(blob, filename)
}

export async function openPropostaPdfInNewTab(opts: PropostaPdfOptions) {
  const popup = window.open('about:blank', '_blank', 'noopener,noreferrer')
  const { blob, filename } = await buildPropostaPdfBlob(opts)
  const url = URL.createObjectURL(blob)
  if (popup) {
    try {
      popup.document.title = filename
    } catch {}
    popup.location.href = url
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
