import { supabase } from '@/services/supabase'
import { fetchOportunidadeById, fetchOportunidadeItens } from '@/services/crm'
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

export function preloadPropostaPdfDeps() {
  depsPromise =
    depsPromise ??
    Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([jspdf, autotable]) => ({
      jsPDF: (jspdf as any).jsPDF,
      autoTable: (autotable as any).default
    }))
  return depsPromise
}

const formatNumber2 = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)

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

  const [{ jsPDF, autoTable }, opp, its, formas, condicoes, empresas] = await Promise.all([
    preloadPropostaPdfDeps(),
    fetchOportunidadeById(oportunidadeId),
    fetchOportunidadeItens(oportunidadeId),
    fetchFinFormasPagamento(),
    fetchFinCondicoesPagamento(),
    fetchFinEmpresasCorrespondentes()
  ])

  if (!opp) throw new Error('Proposta não encontrada.')

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
  if (clienteId) {
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

  const contatoId = String((opp as any)?.id_contato || '').trim()
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
  let y = 14

  const maxContentWidth = right - left

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

  const toDataUrl = async (url: string) => {
    const u = String(url || '').trim()
    if (!u) return ''
    const res = await fetch(u)
    if (!res.ok) return ''
    const blob = await res.blob()
    const mime = String(blob.type || '')
    if (!mime.startsWith('image/')) return ''
    if (mime === 'image/webp') return ''
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Falha ao ler imagem.'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(blob)
    })
  }

  const empresaLogoUrl = getFinEmpresaCorrespondenteLogoUrl((empresa as any)?.logo_path)
  const empresaNomeFantasia = String((empresa as any)?.nome_fantasia || empresaNomeRef).trim() || '—'
  const empresaNome = String((empresa as any)?.razao_social || (empresa as any)?.nome_fantasia || empresaNomeRef).trim() || '—'
  const empresaEnderecoLinha = [String((empresa as any)?.endereco || '').trim(), String((empresa as any)?.bairro || '').trim()].filter(Boolean).join(' - ')
  const empresaCidadeUfCep = [
    [String((empresa as any)?.cidade || '').trim(), String((empresa as any)?.uf || '').trim()].filter(Boolean).join(' - '),
    String((empresa as any)?.cep || '').trim() ? `CEP: ${String((empresa as any)?.cep || '').trim()}` : ''
  ]
    .filter(Boolean)
    .join(' - ')

  let hasLogo = false
  try {
    const dataUrl = await toDataUrl(empresaLogoUrl)
    const mime = dataUrl.startsWith('data:') ? dataUrl.slice(5, dataUrl.indexOf(';')) : ''
    const fmt = mime.includes('png') ? 'PNG' : mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : ''
    if (dataUrl && fmt) {
      doc.addImage(dataUrl, fmt as any, left, y - 2, 20, 20)
      hasLogo = true
    }
  } catch {}

  const headerTopY = y + 2
  const leftHeaderX = hasLogo ? left + 22 : left
  wrapLeft(empresaNomeFantasia, leftHeaderX, headerTopY, 70, 10, true, 4)
  centerText(empresaNome, headerTopY, 10, true)

  const empresaLines = [
    (empresa as any)?.cnpj ? `CNPJ: ${(empresa as any).cnpj}` : null,
    (empresa as any)?.inscricao_estadual ? `Inscrição Estadual: ${(empresa as any).inscricao_estadual}` : null,
    (empresa as any)?.inscricao_municipal ? `Inscrição Municipal: ${(empresa as any).inscricao_municipal}` : null,
    empresaEnderecoLinha ? empresaEnderecoLinha : null,
    empresaCidadeUfCep ? empresaCidadeUfCep : null,
    (empresa as any)?.telefone ? `Telefone: ${(empresa as any).telefone}` : null
  ].filter(Boolean) as string[]
  {
    let yy = y
    for (const line of empresaLines) {
      yy = wrapRight(line, right, yy, 78, 7.2, false, 3.4)
    }
  }

  y += 22
  doc.line(left, y, right, y)
  y += 8

  textLeft(`Proposta Comercial N° ${propostaCodigo}`, left, y, 14, true)
  y += 8
  textLeft('Informações do Cliente', left, y, 10, true)
  y += 6

  y = wrapLeft(clienteNome.toUpperCase(), left, y, 110, 8.5, true, 4.2)
  y = wrapLeft(`${clienteDocumentoLabel}: ${clienteDocumento}`, left, y, 110, 8, false, 4.2)
  if (clienteEnderecoLinha) {
    y = wrapLeft(clienteEnderecoLinha, left, y, 110, 8, false, 4.2)
  }

  const contatoBlockX = left + 120
  const contatoStartY = y - 12.6
  if (contatoStartY > 26) {
    textLeft('Contato', contatoBlockX, contatoStartY, 9, true)
    wrapLeft(contatoNome || '-', contatoBlockX, contatoStartY + 4.5, right - contatoBlockX, 8, false, 4.2)
    if (contatoEmail) wrapLeft(contatoEmail, contatoBlockX, contatoStartY + 8.7, right - contatoBlockX, 8, false, 4.2)
  }

  y += 6
  const itensLabel = inferred === 'SERVICO' ? 'Lista dos Serviços' : inferred === 'PRODUTO' ? 'Lista dos Produtos' : 'Lista de Itens'
  textLeft(itensLabel, left, y, 10, true)
  y += 3

  const rows = items.map((it) => [
    String(it.descricao || ''),
    formatNumber2(it.quantidade),
    showValores ? formatNumber2(it.valorUnitario) : '',
    showValores ? formatNumber2(calcItemTotal(it)) : ''
  ])

  const head = showValores ? [itensHeadLabel, 'Quantidade', 'Valor Unit.', 'Valor Total'] : [itensHeadLabel, 'Quantidade']
  const body = rows.length
    ? rows.map((r) => (showValores ? r : [r[0], r[1]]))
    : [showValores ? ['Nenhum item adicionado.', '', '', ''] : ['Nenhum item adicionado.', '']]

  const tableW = maxContentWidth
  const descW = showValores ? Math.max(60, tableW - (22 + 25 + 25)) : Math.max(60, tableW - 22)

  autoTable(doc, {
    startY: y,
    margin: { left, right },
    tableWidth: tableW,
    head: [head],
    body,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: theme.rgb, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: theme.lightRgb },
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

  const finalY = (doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) : y + 10
  y = finalY + 6

  if (y > pageHeight - 40) {
    doc.addPage()
    y = 18
  }

  if (showValores) {
    textRight('Total:', right - 25, y, 9, true)
    textRight(formatNumber2(total), right, y, 9, true)
    y += 4.5
    textRight('Total do ISS:', right - 25, y, 9, true)
    textRight(formatNumber2(0), right, y, 9, true)
    y += 10
  }

  const otherX = left
  let otherY = y
  textLeft('Outras Informações', otherX, otherY, 10, true)
  otherY += 6
  textLeft(`Proposta Comercial - incluído em: ${emissaoLabel}`, otherX, otherY, 8)
  otherY += 4.5
  textLeft(`Previsão de Faturamento: ${previsaoFaturamentoLabel}`, otherX, otherY, 8)
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

  const filenameBase = `Proposta-${propostaCodigo}`.replaceAll('/', '-').replaceAll('\\', '-').replaceAll(':', '-')
  const filename = `${filenameBase}.pdf`
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
