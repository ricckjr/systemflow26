import { supabase } from '@/services/supabase'

/* ======================================================
   TIPOS
====================================================== */
export interface CRM_Oportunidade {
  id_oport: string
  id_integ: string | null
  cod_oport: string | null
  id_vendedor: string | null
  id_cliente: string | null
  id_contato: string | null
  id_fase: string | null
  id_status: string | null
  id_motivo: string | null
  id_origem: string | null
  solucao: 'PRODUTO' | 'SERVICO' | 'PRODUTO_SERVICO' | null
  obs_oport: string | null
  descricao_oport: string | null
  qts_item: number | null
  prev_entrega: string | null
  forma_pagamento_id?: string | null
  condicao_pagamento_id?: string | null
  tipo_frete?: 'FOB' | 'CIF' | null
  temperatura: number | null
  cod_produto: string | null
  cod_servico: string | null
  desconto_percent_proposta?: number | null
  ticket_valor: number | null
  data_lead: string | null
  data_prospeccao: string | null
  data_apresentacao: string | null
  data_qualificacao: string | null
  data_negociacao: string | null
  data_conquistado: string | null
  data_perdidos: string | null
  data_posvenda: string | null
  data_inclusao: string | null
  data_alteracao: string | null
  data_parado?: string | null

  cliente_nome?: string | null
  cliente_documento?: string | null
  contato_nome?: string | null
  contato_cargo?: string | null
  contato_telefone01?: string | null
  contato_telefone02?: string | null
  contato_email?: string | null
  vendedor_nome?: string | null
  vendedor_avatar_url?: string | null
  pedido_compra_path?: string | null
  pedido_compra_numero?: string | null

  id_oportunidade?: string
  cod_oportunidade?: string | null
  cliente?: string | null
  nome_contato?: string | null
  telefone01_contato?: string | null
  telefone02_contato?: string | null
  email?: string | null
  vendedor?: string | null
  origem?: string | null
  fase?: string | null
  status?: string | null
  valor_proposta?: string | null
  descricao_oportunidade?: string | null
  empresa_correspondente?: string | null
  data?: string | null
  dias_abertos?: number | null
  dias_parado?: number | null
  criado_em?: string | null
  atualizado_em?: string | null
  system_nota?: string | null
}

export type CRM_PropostaComercial = CRM_Oportunidade

export interface CRM_Ligacao {
  id: string
  data_hora: string
  vendedor: string | null
  resultado: string | null
}

export interface CRM_PabxLigacao {
  id_user: string
  vendedor: string
  id_data: string
  ligacoes_feitas: number
  ligacoes_nao_atendidas: number
  updated_at: string
}

export interface CRM_VendedorPerformance {
  id_data: string
  id_user: string
  data_atualizacao: string | null
  ativo: boolean
  vendedor: string
  email_corporativo: string | null
  telefone: string | null
  ramal: string | null
  avatar_url: string | null
  total_quantidade_oportunidades: number
  total_valor_oportunidades: string
  quantidade_andamento: number
  valor_andamento: string
  quantidade_vendido: number
  valor_vendido: string
  quantidade_perdido: number
  valor_perdido: string
  quantidade_suspenso: number
  valor_suspenso: string
  taxa_conversao_real: string
  ticket_medio: string
  novas_meta_total_mes: number
  novas_meta_feita: number
  novas_meta_falta: number
  novas_meta_diaria: number
  novas_progresso_meta: string
  ligacoes_total_mes: number
  ligacoes_feitas: number
  ligacoes_falta: number
  ligacoes_diarias: number
  progresso_ligacoes: string
  meta_financeira_total_mes: string
  meta_financeira_feita: string
  meta_financeira_falta: string
  meta_financeira_diaria: string
  percentual_meta_financeira: string
  progresso_meta_mensal: string
  valor_produto: string
  valor_servicos: string
  pipeline_funil: string | null
  fase_prospeccao: number
  fase_qualificacao: number
  fase_apresentacao: number
  fase_proposta: number
  fase_negociacao: number
  fase_prospeccao_valor: string
  fase_qualificacao_valor: string
  fase_apresentacao_valor: string
  fase_proposta_valor: string
  fase_negociacao_valor: string
  dias_uteis_mes: number
  dias_uteis_restantes: number
  quantidade_cancelado: number
  valor_cancelado: string
}

export interface CRM_Meta {
  id: number
  meta_valor_financeiro: number
  supermeta_valor_financeiro: number
  meta_novas_oportunidades: number
  meta_ligacoes: number
  tempo_ligacoes: number | null
  meta_geral: string | null
}

export interface CRM_IbgeCodigo {
  ibge_id: string
  codigo_ibge: string
  descricao_ibge: string | null
  criado_em: string
  atualizado_em: string
}

export interface CRM_CnaeCodigo {
  cnae_id: string
  codigo_cnae: string
  descricao_cnae: string | null
  criado_em: string
  atualizado_em: string
}

export async function fetchOportunidadesByClienteId(clienteId: string) {
  if (!clienteId) return []
  const r1 = await (supabase as any)
    .from('crm_oportunidades')
    .select('id_oport, cod_oport, id_cliente, id_fase, id_status, fase, status, data_inclusao')
    .eq('id_cliente', clienteId)
    .order('data_inclusao', { ascending: false })

  if (r1.error) {
    if (r1.error.code === '42P01') return []
    if (isMissingColumn(r1.error)) {
      const r2 = await (supabase as any)
        .from('crm_oportunidades')
        .select('id_oport, cod_oport, id_cliente, id_fase, id_status, data_inclusao')
        .eq('id_cliente', clienteId)
        .order('data_inclusao', { ascending: false })
      if (r2.error) return []
      return (r2.data ?? []) as CRM_Oportunidade[]
    }
    return []
  }

  return (r1.data ?? []) as CRM_Oportunidade[]
}

export async function fetchCrmIbgeCodigos() {
  const { data, error } = await sb
    .from('crm_ibge_codigos')
    .select('ibge_id, codigo_ibge, descricao_ibge, criado_em, atualizado_em')
    .order('codigo_ibge', { ascending: true })

  if (error) return []
  return (data ?? []) as CRM_IbgeCodigo[]
}

export async function createCrmIbgeCodigo(payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('crm_ibge_codigos')
    .insert({ codigo_ibge: payload.codigo, descricao_ibge: payload.descricao || null })
    .select('ibge_id, codigo_ibge, descricao_ibge, criado_em, atualizado_em')
    .single()
  if (error) throw error
  return data as CRM_IbgeCodigo
}

export async function updateCrmIbgeCodigo(id: string, payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('crm_ibge_codigos')
    .update({ codigo_ibge: payload.codigo, descricao_ibge: payload.descricao || null, atualizado_em: new Date().toISOString() })
    .eq('ibge_id', id)
    .select('ibge_id, codigo_ibge, descricao_ibge, criado_em, atualizado_em')
    .single()
  if (error) throw error
  return data as CRM_IbgeCodigo
}

export async function deleteCrmIbgeCodigo(id: string) {
  const { error } = await sb.from('crm_ibge_codigos').delete().eq('ibge_id', id)
  if (error) throw error
}

export async function fetchCrmCnaeCodigos() {
  const { data, error } = await sb
    .from('crm_cnae_codigos')
    .select('cnae_id, codigo_cnae, descricao_cnae, criado_em, atualizado_em')
    .order('codigo_cnae', { ascending: true })

  if (error) return []
  return (data ?? []) as CRM_CnaeCodigo[]
}

export async function createCrmCnaeCodigo(payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('crm_cnae_codigos')
    .insert({ codigo_cnae: payload.codigo, descricao_cnae: payload.descricao || null })
    .select('cnae_id, codigo_cnae, descricao_cnae, criado_em, atualizado_em')
    .single()
  if (error) throw error
  return data as CRM_CnaeCodigo
}

export async function updateCrmCnaeCodigo(id: string, payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('crm_cnae_codigos')
    .update({ codigo_cnae: payload.codigo, descricao_cnae: payload.descricao || null, atualizado_em: new Date().toISOString() })
    .eq('cnae_id', id)
    .select('cnae_id, codigo_cnae, descricao_cnae, criado_em, atualizado_em')
    .single()
  if (error) throw error
  return data as CRM_CnaeCodigo
}

export async function deleteCrmCnaeCodigo(id: string) {
  const { error } = await sb.from('crm_cnae_codigos').delete().eq('cnae_id', id)
  if (error) throw error
}

/* ======================================================
   PROPOSTAS COMERCIAIS (LEVE E RÁPIDO)
====================================================== */
export async function fetchOportunidades(opts?: { orderDesc?: boolean }) {
  const orderDesc = opts?.orderDesc ?? true
  const coreV2 = `
    id_oport,
    id_integ,
    cod_oport,
    id_vendedor,
    id_cliente,
    id_contato,
    id_fase,
    id_status,
    id_motivo,
    id_origem,
    solucao,
    obs_oport,
    descricao_oport,
    qts_item,
    prev_entrega,
    temperatura,
    cod_produto,
    cod_servico,
    desconto_percent_proposta,
    ticket_valor,
    data_lead,
    data_prospeccao,
    data_apresentacao,
    data_qualificacao,
    data_negociacao,
    data_conquistado,
    data_perdidos,
    data_posvenda,
    data_inclusao,
    data_alteracao
  `

  const extendedV2 = `${coreV2},
    forma_pagamento_id,
    condicao_pagamento_id,
    tipo_frete,
    pedido_compra_path,
    pedido_compra_numero
  `

  const wideV2 = `${extendedV2},
    data_parado,
    cliente_nome,
    cliente_documento,
    contato_nome,
    contato_cargo,
    contato_telefone01,
    contato_telefone02,
    contato_email,
    vendedor_nome,
    vendedor_avatar_url,
    cliente,
    nome_contato,
    telefone01_contato,
    telefone02_contato,
    email,
    vendedor,
    origem,
    fase,
    status,
    valor_proposta,
    empresa_correspondente,
    data,
    dias_abertos,
    dias_parado,
    criado_em,
    atualizado_em,
    system_nota
  `

  const qWide = (supabase as any)
    .from('crm_oportunidades')
    .select(wideV2)
    .order('data_inclusao', { ascending: !orderDesc })

  const rWide = await qWide
  if (!rWide.error) return (rWide.data || []) as CRM_Oportunidade[]

  const msgWide = String(rWide.error?.message || '')
  const isMissingWide =
    rWide.error?.code === 'PGRST204' ||
    rWide.error?.code === '42703' ||
    (msgWide.includes('Could not find') && msgWide.toLowerCase().includes('column')) ||
    (msgWide.toLowerCase().includes('column') && msgWide.toLowerCase().includes('schema cache'))

  if (!isMissingWide && rWide.error?.code === '42P01') return []

  if (isMissingWide) {
    // 1. Tenta extendedV2 (campos comuns atuais)
    const q = (supabase as any)
      .from('crm_oportunidades')
      .select(extendedV2)
      .order('data_inclusao', { ascending: !orderDesc })
    const r = await q
    if (!r.error) return (r.data || []) as CRM_Oportunidade[]
    if (r.error.code === '42P01') return []

    // 2. Se falhar por coluna inexistente, tenta coreV2 (sem campos opcionais)
    const isMissingBase =
      r.error?.code === 'PGRST204' ||
      r.error?.code === '42703' ||
      (String(r.error?.message).includes('Could not find') && String(r.error?.message).toLowerCase().includes('column'))
    
    if (isMissingBase) {
      const qCore = (supabase as any)
        .from('crm_oportunidades')
        .select(coreV2)
        .order('data_inclusao', { ascending: !orderDesc })
      const rCore = await qCore
      if (!rCore.error) return (rCore.data || []) as CRM_Oportunidade[]
      if (rCore.error.code === '42P01') return []

      const minimalLegacyIds = `
        id_oport,
        cod_oport,
        id_cliente,
        id_vendedor,
        id_fase,
        id_status,
        contato_id,
        orig_id,
        descricao_oport,
        ticket_valor,
        data_inclusao
      `
      const qLegacyIds = (supabase as any)
        .from('crm_oportunidades')
        .select(minimalLegacyIds)
        .order('data_inclusao', { ascending: !orderDesc })
      const rLegacyIds = await qLegacyIds
      if (!rLegacyIds.error) {
        return (rLegacyIds.data || []).map((row: any) => ({
          ...row,
          id_contato: row.id_contato ?? row.contato_id ?? null,
          id_origem: row.id_origem ?? row.orig_id ?? null
        })) as CRM_Oportunidade[]
      }

      const minimalV2 = `
        id_oport,
        cod_oport,
        id_cliente,
        id_vendedor,
        id_fase,
        id_status,
        descricao_oport,
        ticket_valor,
        data_inclusao
      `
      const qMin = (supabase as any)
        .from('crm_oportunidades')
        .select(minimalV2)
        .order('data_inclusao', { ascending: !orderDesc })
      const rMin = await qMin
      if (!rMin.error) return (rMin.data || []) as CRM_Oportunidade[]
    }
  }

  if (rWide.error?.code === '42P01') return []

  const baseLegacy = `
    id_oportunidade,
    cod_oportunidade,
    cliente,
    nome_contato,
    telefone01_contato,
    telefone02_contato,
    email,
    id_vendedor,
    vendedor,
    solucao,
    origem,
    status,
    temperatura,
    valor_proposta,
    descricao_oportunidade,
    observacoes_vendedor,
    empresa_correspondente,
    data_inclusao,
    data,
    dias_abertos,
    dias_parado,
    criado_em,
    atualizado_em,
    system_nota,
    fase
  `

  const q2 = (supabase as any)
    .from('crm_oportunidades')
    .select(baseLegacy)
    .order('data_inclusao', { ascending: !orderDesc })
  const r2 = await q2
  if (r2.error) {
    const q3 = (supabase as any)
      .from('crm_oportunidades')
      .select(`${baseLegacy.replace(', fase', '')}, etapa`)
      .order('data_inclusao', { ascending: !orderDesc })
    const r3 = await q3
    if (r3.error) {
      console.error('Erro ao buscar oportunidades:', r3.error)
      return []
    }
    return (r3.data || []).map((row: any) => ({
      ...row,
      fase: row.etapa ?? null,
      id_oport: row.id_oportunidade,
      cod_oport: row.cod_oportunidade,
      id_integ: null,
      id_cliente: null,
      id_contato: null,
      id_fase: null,
      id_status: null,
      id_motivo: null,
      id_origem: null,
      obs_oport: row.observacoes_vendedor ?? null,
      descricao_oport: row.descricao_oportunidade ?? null,
      qts_item: null,
      prev_entrega: null,
      cod_produto: null,
      cod_servico: null,
      ticket_valor: row.valor_proposta ? Number.parseFloat(String(row.valor_proposta).replace(',', '.')) : null,
      data_lead: null,
      data_prospeccao: null,
      data_apresentacao: null,
      data_qualificacao: null,
      data_negociacao: null,
      data_conquistado: null,
      data_perdidos: null,
      data_posvenda: null,
      data_alteracao: row.atualizado_em ?? null
    })) as CRM_Oportunidade[]
  }

  return (r2.data || []).map((row: any) => ({
    ...row,
    id_oport: row.id_oportunidade,
    cod_oport: row.cod_oportunidade,
    id_integ: null,
    id_cliente: null,
    id_contato: null,
    id_fase: null,
    id_status: null,
    id_motivo: null,
    id_origem: null,
    obs_oport: row.observacoes_vendedor ?? null,
    descricao_oport: row.descricao_oportunidade ?? null,
    qts_item: null,
    prev_entrega: null,
    cod_produto: null,
    cod_servico: null,
    ticket_valor: row.valor_proposta ? Number.parseFloat(String(row.valor_proposta).replace(',', '.')) : null,
    data_lead: null,
    data_prospeccao: null,
    data_apresentacao: null,
    data_qualificacao: null,
    data_negociacao: null,
    data_conquistado: null,
    data_perdidos: null,
    data_posvenda: null,
    data_alteracao: row.atualizado_em ?? null
  })) as CRM_Oportunidade[]
}

export async function updateOportunidade(id: string, updates: Partial<CRM_Oportunidade>) {
  let sanitized: any = { ...(updates as any) }
  if (sanitized.id_contato && !sanitized.contato_id) sanitized.contato_id = sanitized.id_contato
  if (sanitized.contato_id && !sanitized.id_contato) sanitized.id_contato = sanitized.contato_id
  if (sanitized.id_origem && !sanitized.orig_id) sanitized.orig_id = sanitized.id_origem
  if (sanitized.orig_id && !sanitized.id_origem) sanitized.id_origem = sanitized.orig_id
  for (let i = 0; i < 6; i++) {
    const q = (supabase as any)
      .from('crm_oportunidades')
      .update(sanitized)
      .eq('id_oport', id)
      .select()
      .single()

    const { data, error } = await q
    if (!error) return data as CRM_Oportunidade
    if (error.code === '42P01') throw new Error('Tabela crm_oportunidades ainda não foi criada.')

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing && Object.prototype.hasOwnProperty.call(sanitized, missing)) {
        delete sanitized[missing]
        continue
      }

      const missingFromFilter =
        missing === 'id_oport' ||
        String(error?.message || '').toLowerCase().includes("id_oport") ||
        String(error?.message || '').toLowerCase().includes("id_oportunidade")

      if (!missingFromFilter) throw toUserFacingError(error, 'Falha ao salvar a proposta comercial.')
      break
    }

    throw toUserFacingError(error, 'Falha ao salvar a proposta comercial.')
  }

  const { id_fase, id_status, id_motivo, id_origem, fase, ...rest } = updates as any
  const stageLabel = fase
  const fallbackBase: any = { ...rest }
  if (stageLabel !== undefined) fallbackBase.fase = stageLabel

  const q2 = (supabase as any)
    .from('crm_oportunidades')
    .update(fallbackBase)
    .eq('id_oportunidade', id)
    .select()
    .single()
  const r2 = await q2
  if (!r2.error) {
    return { ...(r2.data as any), fase: (r2.data as any)?.fase ?? (r2.data as any)?.etapa ?? null } as CRM_Oportunidade
  }

  if (isMissingColumn(r2.error) && stageLabel !== undefined) {
    const q3 = (supabase as any)
      .from('crm_oportunidades')
      .update({ ...rest, etapa: stageLabel })
      .eq('id_oportunidade', id)
      .select()
      .single()
    const r3 = await q3
    if (r3.error) throw toUserFacingError(r3.error, 'Falha ao salvar a proposta comercial.')
    return { ...(r3.data as any), fase: (r3.data as any)?.etapa ?? null } as CRM_Oportunidade
  }

  throw toUserFacingError(r2.error, 'Falha ao salvar a proposta comercial.')
}

export async function createOportunidade(payload: Partial<CRM_Oportunidade>) {
  let sanitized: any = { ...(payload as any) }
  if (sanitized.id_contato && !sanitized.contato_id) sanitized.contato_id = sanitized.id_contato
  if (sanitized.contato_id && !sanitized.id_contato) sanitized.id_contato = sanitized.contato_id
  if (sanitized.id_origem && !sanitized.orig_id) sanitized.orig_id = sanitized.id_origem
  if (sanitized.orig_id && !sanitized.id_origem) sanitized.id_origem = sanitized.orig_id
  for (let i = 0; i < 6; i++) {
    const q = (supabase as any)
      .from('crm_oportunidades')
      .insert(sanitized)
      .select()
      .single()

    const { data, error } = await q
    if (!error) return data as CRM_Oportunidade
    if (error.code === '42P01') throw new Error('Tabela crm_oportunidades ainda não foi criada.')

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing && Object.prototype.hasOwnProperty.call(sanitized, missing)) {
        delete sanitized[missing]
        continue
      }
    }

    throw toUserFacingError(error, 'Falha ao criar a proposta comercial.')
  }

  throw new Error('Falha ao criar a proposta comercial.')
}

export async function fetchOportunidadeById(id: string) {
  const oportunidadeId = String(id || '').trim()
  if (!oportunidadeId) return null
  const { data, error } = await (supabase as any).from('crm_oportunidades').select().eq('id_oport', oportunidadeId).single()
  if (error) {
    if (error.code === '42P01') return null
    throw toUserFacingError(error, 'Falha ao carregar a proposta comercial.')
  }
  return data as CRM_Oportunidade
}

export async function deleteOportunidade(id: string) {
  const oportunidadeId = String(id || '').trim()
  if (!oportunidadeId) return
  const delItens = await sb.from('crm_oportunidade_itens').delete().eq('id_oport', oportunidadeId)
  if (delItens.error && !isMissingTable(delItens.error)) {
    throw toUserFacingError(delItens.error, 'Falha ao excluir itens da proposta.')
  }
  const delComentarios = await sb.from('crm_oportunidade_comentarios').delete().eq('id_oport', oportunidadeId)
  if (delComentarios.error && !isMissingTable(delComentarios.error)) {
    throw toUserFacingError(delComentarios.error, 'Falha ao excluir comentários da proposta.')
  }
  const delAtividades = await sb.from('crm_oportunidade_atividades').delete().eq('id_oport', oportunidadeId)
  if (delAtividades.error && !isMissingTable(delAtividades.error)) {
    throw toUserFacingError(delAtividades.error, 'Falha ao excluir atividades da proposta.')
  }

  const delOpp = await sb.from('crm_oportunidades').delete().eq('id_oport', oportunidadeId)
  if (delOpp.error) {
    if (isMissingTable(delOpp.error)) return
    throw toUserFacingError(delOpp.error, 'Falha ao excluir a proposta comercial.')
  }
}

export async function fetchPropostasComerciais(opts?: { orderDesc?: boolean }) {
  return fetchOportunidades(opts)
}

export async function fetchPropostasComerciaisByClienteId(clienteId: string) {
  return fetchOportunidadesByClienteId(clienteId)
}

export async function updatePropostaComercial(id: string, updates: Partial<CRM_Oportunidade>) {
  return updateOportunidade(id, updates)
}

export async function createPropostaComercial(payload: Partial<CRM_Oportunidade>) {
  return createOportunidade(payload)
}

/* ======================================================
   HELPERS DE STATUS
====================================================== */
export const isVenda = (s?: string | null) =>
  ['CONQUISTADO', 'FATURADO', 'GANHO', 'VENDIDO'].includes(
    (s || '').trim().toUpperCase()
  )

export const isAtivo = (s?: string | null) =>
  !['CANCELADO', 'PERDIDO', 'FATURADO', 'CONQUISTADO', 'GANHO', 'VENDIDO'].includes(
    (s || '').trim().toUpperCase()
  )

/* ======================================================
   LIGAÇÕES
====================================================== */
export async function fetchLigacoes() {
  const { data, error } = await supabase
    .from('crm_ligacoes')
    .select('id, data_hora, vendedor, resultado')
    .order('data_hora', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    console.error('Erro ao buscar ligações:', error)
    return []
  }

  return data as CRM_Ligacao[]
}

export async function fetchPabxLigacoes() {
  const { data, error } = await supabase
    .from('crm_pabx_ligacoes')
    .select(`
      id_user,
      vendedor,
      id_data,
      ligacoes_feitas,
      ligacoes_nao_atendidas,
      updated_at
    `)
    .order('id_data', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    console.error('Erro ao buscar ligações PABX:', error)
    return []
  }

  return data as CRM_PabxLigacao[]
}

export async function fetchVendedoresPerformance(opts?: { idData?: string }) {
  const q = (supabase as any)
    .from('crm_vendedores_performance')
    .select('*')
    .order('vendedor', { ascending: true })

  const { data, error } = opts?.idData ? await q.eq('id_data', opts.idData) : await q

  if (error) {
    if (error.code === '42P01') return []
    console.error('Erro ao buscar performance de vendedores:', error)
    return []
  }

  return data as CRM_VendedorPerformance[]
}

/* ======================================================
   METAS COMERCIAIS
====================================================== */
export async function fetchMeta() {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .select(`
      id,
      meta_valor_financeiro,
      supermeta_valor_financeiro,
      meta_novas_oportunidades,
      meta_ligacoes,
      tempo_ligacoes,
      meta_geral
    `)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Erro ao buscar metas:', error)
    return null
  }

  return data as CRM_Meta
}

export async function createMeta(meta: Omit<CRM_Meta, 'id'>) {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .insert(meta)
    .select(`
      id,
      meta_valor_financeiro,
      supermeta_valor_financeiro,
      meta_novas_oportunidades,
      meta_ligacoes,
      tempo_ligacoes,
      meta_geral
    `)
    .single()

  if (error) throw error
  return data as CRM_Meta
}

export async function updateMeta(
  id: number,
  updates: Partial<CRM_Meta>
) {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .update(updates)
    .eq('id', id)
    .select(`
      id,
      meta_valor_financeiro,
      supermeta_valor_financeiro,
      meta_novas_oportunidades,
      meta_ligacoes,
      tempo_ligacoes,
      meta_geral
    `)
    .single()

  if (error) throw error
  return data as CRM_Meta
}

export interface CRM_Motivo {
  motiv_id: string
  integ_id: string | null
  descricao_motiv: string
  obs_motiv: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_OrigemLead {
  orig_id: string
  integ_id: string | null
  descricao_orig: string
  obs_orig: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Produto {
  prod_id: string
  integ_id: string | null
  codigo_prod: string | null
  situacao_prod: boolean
  marca_prod: string | null
  modelo_prod: string | null
  descricao_prod: string
  gtin_ean?: string | null
  imagem_path?: string | null
  cod_proposta_ref?: string | null
  unidade_prod?: string | null
  ncm_codigo?: string | null
  local_estoque?: '03' | '04' | 'PADRAO' | 'INTERNO' | string | null
  familia_id?: string | null
  obs_prod: string | null
  produto_valor: number | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Servico {
  serv_id: string
  integ_id: string | null
  codigo_serv: string | null
  situacao_serv: boolean
  descricao_serv: string
  obs_serv: string | null
  servicos_valor: number | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Vertical {
  vert_id: string
  integ_id: string | null
  descricao_vert: string
  obs_ver: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Fase {
  fase_id: string
  integ_id: string | null
  fase_desc: string
  fase_obs: string | null
  fase_ordem: number | null
  fase_cor: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Status {
  status_id: string
  integ_id: string | null
  status_desc: string
  status_obs: string | null
  status_ordem: number | null
  status_cor: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_OportunidadeItem {
  item_id: string
  id_oport: string
  tipo: 'PRODUTO' | 'SERVICO'
  produto_id: string | null
  servico_id: string | null
  descricao_item: string | null
  quantidade: number
  desconto_percent: number
  valor_unitario: number
  valor_total: number
  created_at: string
  updated_at: string
}

export interface CRM_OportunidadeComentario {
  comentario_id: string
  id_oport: string
  comentario: string
  created_at: string
}

export interface CRM_OportunidadeAtividade {
  atividade_id: string
  id_oport: string
  tipo: string
  payload: any
  created_at: string
}

const isMissingTable = (error: any) => {
  const code = error?.code
  if (code === '42P01') return true
  if (code === 'PGRST205') return true
  const msg = String(error?.message || '')
  return msg.includes('schema cache') && msg.includes('Could not find the table')
}

const isMissingColumn = (error: any) => {
  const code = String(error?.code || '')
  const msg = String(error?.message || '')
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (msg.includes('Could not find') && msg.toLowerCase().includes('column')) ||
    (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('schema cache'))
  )
}

const extractMissingColumnName = (error: any) => {
  const msg = String(error?.message || '')
  const m1 = msg.match(/Could not find the '([^']+)' column/i)
  if (m1?.[1]) return m1[1]
  const m2 = msg.match(/column "([^"]+)"/i)
  if (m2?.[1]) return m2[1]
  const m3 = msg.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i)
  if (m3?.[1]) {
    const full = m3[1]
    const parts = full.split('.').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : full
  }
  return null
}

const toUserFacingError = (error: any, fallback: string) => {
  if (error instanceof Error) return error
  const msg = String(error?.message || '').trim()
  const details = String(error?.details || '').trim()
  const code = String(error?.code || '').trim()

  const combined = `${msg}\n${details}`.trim()
  const lc = combined.toLowerCase()

  if (lc.includes('row level security') || lc.includes('violates row-level security policy')) {
    return new Error('Sem permissão para realizar esta ação no CRM (exige CRM:EDIT).')
  }

  const best = msg || details
  const withCode = best ? (code ? `${best} (${code})` : best) : fallback
  return new Error(withCode)
}

const missingTableError = (table: string) =>
  new Error(
    `Tabela "${table}" não existe no banco (migrations ainda não aplicadas ou API sem recarregar schema). Execute as migrations e reinicie/recarregue o schema do Supabase/PostgREST.`
  )

const extractConstraintName = (error: any) => {
  const msg = String(error?.message || '')
  const details = String(error?.details || '')
  const combined = `${msg}\n${details}`
  const m = combined.match(/constraint \"([^\"]+)\"/i) || combined.match(/unique constraint \"([^\"]+)\"/i)
  return m?.[1] || null
}

const mapCrmFaseConstraintError = (error: any) => {
  const code = String(error?.code || '')
  const constraint = extractConstraintName(error)
  if (code !== '23505' && code !== '23514') return null

  if (constraint === 'uq_crm_fase_desc_ci' || constraint === 'uq_crm_etapa_desc_ci' || constraint === 'uq_crm_etapa_desc') {
    return new Error('Já existe uma Fase CRM com esse nome.')
  }
  if (constraint === 'uq_crm_fase_ordem' || constraint === 'uq_crm_etapa_ordem') {
    return new Error('Já existe uma Fase CRM com essa ordem. Use outra ordem ou deixe 0 para automático.')
  }
  if (constraint === 'uq_crm_fase_cor' || constraint === 'uq_crm_etapa_cor') {
    return new Error('Já existe uma Fase CRM com essa cor. Escolha outra cor.')
  }
  if (constraint === 'chk_crm_fase_cor_hex' || constraint === 'chk_crm_etapa_cor_hex') {
    return new Error('Cor inválida. Use o formato #RRGGBB.')
  }
  if (constraint === 'chk_crm_fase_desc_not_empty' || constraint === 'chk_crm_etapa_desc_not_empty') {
    return new Error('O nome da Fase CRM é obrigatório.')
  }

  return new Error('Não foi possível salvar a Fase CRM por violação de regra (nome/ordem/cor).')
}

const mapCrmStatusConstraintError = (error: any) => {
  const code = String(error?.code || '')
  const constraint = extractConstraintName(error)
  if (code !== '23505' && code !== '23514') return null

  if (constraint === 'uq_crm_status_desc_ci' || constraint === 'uq_crm_status_desc') {
    return new Error('Já existe um Status CRM com esse nome.')
  }
  if (constraint === 'uq_crm_status_ordem') {
    return new Error('Já existe um Status CRM com essa ordem. Use outra ordem ou deixe 0 para automático.')
  }
  if (constraint === 'uq_crm_status_cor') {
    return new Error('Já existe um Status CRM com essa cor. Escolha outra cor.')
  }
  if (constraint === 'chk_crm_status_cor_hex') {
    return new Error('Cor inválida. Use o formato #RRGGBB.')
  }
  if (constraint === 'chk_crm_status_desc_not_empty') {
    return new Error('O nome do Status CRM é obrigatório.')
  }

  return new Error('Não foi possível salvar o Status CRM por violação de regra (nome/ordem/cor).')
}
const sb = supabase as any

export async function fetchOportunidadeItens(oportunidadeId: string) {
  if (!oportunidadeId) return []
  const { data, error } = await sb
    .from('crm_oportunidade_itens')
    .select(
      'item_id, id_oport, tipo, produto_id, servico_id, descricao_item, quantidade, desconto_percent, valor_unitario, valor_total, created_at, updated_at'
    )
    .eq('id_oport', oportunidadeId)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar itens da proposta comercial:', error)
    return []
  }
  return (data ?? []) as CRM_OportunidadeItem[]
}

export async function replaceOportunidadeItens(
  oportunidadeId: string,
  items: Array<
    Pick<
      CRM_OportunidadeItem,
      'tipo' | 'produto_id' | 'servico_id' | 'descricao_item' | 'quantidade' | 'desconto_percent' | 'valor_unitario' | 'valor_total'
    >
  >
) {
  if (!oportunidadeId) throw new Error('ID da proposta comercial inválido.')

  const del = await sb.from('crm_oportunidade_itens').delete().eq('id_oport', oportunidadeId)
  if (del.error) {
    if (!isMissingTable(del.error)) throw del.error
    return
  }

  const payload = (items || []).map((i) => ({
    id_oport: oportunidadeId,
    tipo: i.tipo,
    produto_id: i.produto_id ?? null,
    servico_id: i.servico_id ?? null,
    descricao_item: i.descricao_item ?? null,
    quantidade: i.quantidade ?? 1,
    desconto_percent: i.desconto_percent ?? 0,
    valor_unitario: i.valor_unitario ?? 0,
    valor_total: i.valor_total ?? 0
  }))

  if (payload.length === 0) return

  const ins = await sb.from('crm_oportunidade_itens').insert(payload)
  if (ins.error) {
    if (isMissingTable(ins.error)) return
    throw ins.error
  }
}

export async function fetchOportunidadeComentarios(oportunidadeId: string) {
  if (!oportunidadeId) return []
  const { data, error } = await sb
    .from('crm_oportunidade_comentarios')
    .select('comentario_id, id_oport, comentario, created_at')
    .eq('id_oport', oportunidadeId)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar comentários da proposta comercial:', error)
    return []
  }
  return (data ?? []) as CRM_OportunidadeComentario[]
}

export async function createOportunidadeComentario(oportunidadeId: string, comentario: string) {
  const text = (comentario || '').trim()
  if (!oportunidadeId) throw new Error('ID da proposta comercial inválido.')
  if (!text) throw new Error('Comentário vazio.')

  const { data, error } = await sb
    .from('crm_oportunidade_comentarios')
    .insert({ id_oport: oportunidadeId, comentario: text })
    .select('comentario_id, id_oport, comentario, created_at')
    .single()

  if (error) {
    if (isMissingTable(error)) return null
    throw error
  }
  return data as CRM_OportunidadeComentario
}

export async function fetchOportunidadeAtividades(oportunidadeId: string) {
  if (!oportunidadeId) return []
  const { data, error } = await sb
    .from('crm_oportunidade_atividades')
    .select('atividade_id, id_oport, tipo, payload, created_at')
    .eq('id_oport', oportunidadeId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar histórico da proposta comercial:', error)
    return []
  }
  return (data ?? []) as CRM_OportunidadeAtividade[]
}

export async function fetchCrmMotivos() {
  const { data, error } = await sb
    .from('crm_motivos')
    .select('motiv_id, integ_id, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .order('descricao_motiv', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar motivos:', error)
    return []
  }

  return data as CRM_Motivo[]
}

export async function createCrmMotivo(payload: Pick<CRM_Motivo, 'integ_id' | 'descricao_motiv' | 'obs_motiv'>) {
  const { data, error } = await sb
    .from('crm_motivos')
    .insert({
      integ_id: payload.integ_id || null,
      descricao_motiv: payload.descricao_motiv,
      obs_motiv: payload.obs_motiv || null
    })
    .select('motiv_id, integ_id, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Motivo
}

export async function updateCrmMotivo(id: string, updates: Partial<Pick<CRM_Motivo, 'integ_id' | 'descricao_motiv' | 'obs_motiv'>>) {
  const { data, error } = await sb
    .from('crm_motivos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('motiv_id', id)
    .select('motiv_id, integ_id, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Motivo
}

export async function deleteCrmMotivo(id: string) {
  const { error } = await sb.from('crm_motivos').delete().eq('motiv_id', id)
  if (error) throw error
}

export async function fetchCrmOrigensLead() {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .select('orig_id, integ_id, descricao_orig, obs_orig, criado_em, atualizado_em')
    .order('descricao_orig', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar origens de leads:', error)
    return []
  }

  return data as CRM_OrigemLead[]
}

export async function createCrmOrigemLead(payload: Pick<CRM_OrigemLead, 'integ_id' | 'descricao_orig' | 'obs_orig'>) {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .insert({
      integ_id: payload.integ_id || null,
      descricao_orig: payload.descricao_orig,
      obs_orig: payload.obs_orig || null
    })
    .select('orig_id, integ_id, descricao_orig, obs_orig, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_OrigemLead
}

export async function updateCrmOrigemLead(id: string, updates: Partial<Pick<CRM_OrigemLead, 'integ_id' | 'descricao_orig' | 'obs_orig'>>) {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('orig_id', id)
    .select('orig_id, integ_id, descricao_orig, obs_orig, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_OrigemLead
}

export async function deleteCrmOrigemLead(id: string) {
  const { error } = await sb.from('crm_origem_leads').delete().eq('orig_id', id)
  if (error) throw error
}

export async function fetchCrmProdutos() {
  const table = 'crm_produtos'
  const cols = [
    'prod_id',
    'integ_id',
    'codigo_prod',
    'situacao_prod',
    'marca_prod',
    'modelo_prod',
    'descricao_prod',
    'gtin_ean',
    'imagem_path',
    'cod_proposta_ref',
    'unidade_prod',
    'ncm_codigo',
    'local_estoque',
    'familia_id',
    'obs_prod',
    'produto_valor',
    'criado_em',
    'atualizado_em'
  ]

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .select(cols.join(', '))
      .order('descricao_prod', { ascending: true })

    if (!error) return data as CRM_Produto[]
    if (isMissingTable(error)) return []

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        const idx = cols.indexOf(missing)
        if (idx >= 0) {
          cols.splice(idx, 1)
          continue
        }
      }
    }

    console.error('Erro ao buscar produtos:', error)
    return []
  }

  return []
}

export async function createCrmProduto(
  payload: Pick<
    CRM_Produto,
    | 'integ_id'
    | 'descricao_prod'
    | 'obs_prod'
    | 'produto_valor'
    | 'situacao_prod'
    | 'marca_prod'
    | 'modelo_prod'
    | 'gtin_ean'
    | 'cod_proposta_ref'
    | 'unidade_prod'
    | 'ncm_codigo'
    | 'local_estoque'
    | 'familia_id'
  >
) {
  const table = 'crm_produtos'
  const cols = [
    'prod_id',
    'integ_id',
    'codigo_prod',
    'situacao_prod',
    'marca_prod',
    'modelo_prod',
    'descricao_prod',
    'gtin_ean',
    'imagem_path',
    'cod_proposta_ref',
    'unidade_prod',
    'ncm_codigo',
    'local_estoque',
    'familia_id',
    'obs_prod',
    'produto_valor',
    'criado_em',
    'atualizado_em'
  ]
  const insertPayload: any = {
    integ_id: payload.integ_id || null,
    situacao_prod: payload.situacao_prod ?? true,
    marca_prod: payload.marca_prod || null,
    modelo_prod: payload.modelo_prod || null,
    descricao_prod: payload.descricao_prod,
    gtin_ean: payload.gtin_ean || null,
    cod_proposta_ref: payload.cod_proposta_ref || null,
    unidade_prod: payload.unidade_prod || null,
    ncm_codigo: payload.ncm_codigo || null,
    local_estoque: payload.local_estoque || '03',
    familia_id: payload.familia_id || null,
    obs_prod: payload.obs_prod || null,
    produto_valor: payload.produto_valor ?? 0
  }

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .insert(insertPayload)
      .select(cols.join(', '))
      .single()

    if (!error) return data as CRM_Produto

    if (isMissingTable(error)) throw missingTableError(table)

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (Object.prototype.hasOwnProperty.call(insertPayload, missing)) delete insertPayload[missing]
        const idx = cols.indexOf(missing)
        if (idx >= 0) cols.splice(idx, 1)
        continue
      }
    }

    throw toUserFacingError(error, 'Falha ao criar o produto.')
  }

  throw new Error('Falha ao criar o produto.')
}

export async function updateCrmProduto(
  id: string,
  updates: Partial<
    Pick<
      CRM_Produto,
      | 'integ_id'
      | 'descricao_prod'
      | 'obs_prod'
      | 'produto_valor'
      | 'situacao_prod'
      | 'marca_prod'
      | 'modelo_prod'
      | 'gtin_ean'
      | 'imagem_path'
      | 'cod_proposta_ref'
      | 'unidade_prod'
      | 'ncm_codigo'
      | 'local_estoque'
      | 'familia_id'
    >
  >
) {
  const table = 'crm_produtos'
  const cols = [
    'prod_id',
    'integ_id',
    'codigo_prod',
    'situacao_prod',
    'marca_prod',
    'modelo_prod',
    'descricao_prod',
    'gtin_ean',
    'imagem_path',
    'cod_proposta_ref',
    'unidade_prod',
    'ncm_codigo',
    'local_estoque',
    'familia_id',
    'obs_prod',
    'produto_valor',
    'criado_em',
    'atualizado_em'
  ]
  const updatePayload: any = { ...updates, atualizado_em: new Date().toISOString() }

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .update(updatePayload)
      .eq('prod_id', id)
      .select(cols.join(', '))
      .single()

    if (!error) return data as CRM_Produto
    if (isMissingTable(error)) throw missingTableError(table)

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (Object.prototype.hasOwnProperty.call(updatePayload, missing)) delete updatePayload[missing]
        const idx = cols.indexOf(missing)
        if (idx >= 0) cols.splice(idx, 1)
        continue
      }
    }

    throw toUserFacingError(error, 'Falha ao atualizar o produto.')
  }

  throw new Error('Falha ao atualizar o produto.')
}

export async function deleteCrmProduto(id: string) {
  const { error } = await sb.from('crm_produtos').delete().eq('prod_id', id)
  if (error) throw error
}

export async function fetchCrmServicos() {
  const table = 'crm_servicos'
  const cols = [
    'serv_id',
    'integ_id',
    'codigo_serv',
    'situacao_serv',
    'descricao_serv',
    'obs_serv',
    'servicos_valor',
    'criado_em',
    'atualizado_em'
  ]

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .select(cols.join(', '))
      .order('descricao_serv', { ascending: true })

    if (!error) return data as CRM_Servico[]
    if (isMissingTable(error)) return []

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        const idx = cols.indexOf(missing)
        if (idx >= 0) {
          cols.splice(idx, 1)
          continue
        }
      }
    }

    console.error('Erro ao buscar serviços:', error)
    return []
  }

  return []
}

export async function createCrmServico(
  payload: Pick<CRM_Servico, 'integ_id' | 'descricao_serv' | 'obs_serv' | 'servicos_valor' | 'situacao_serv'>
) {
  const table = 'crm_servicos'
  const cols = [
    'serv_id',
    'integ_id',
    'codigo_serv',
    'situacao_serv',
    'descricao_serv',
    'obs_serv',
    'servicos_valor',
    'criado_em',
    'atualizado_em'
  ]
  const insertPayload: any = {
    integ_id: payload.integ_id || null,
    situacao_serv: payload.situacao_serv ?? true,
    descricao_serv: payload.descricao_serv,
    obs_serv: payload.obs_serv || null,
    servicos_valor: payload.servicos_valor ?? 0
  }

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .insert(insertPayload)
      .select(cols.join(', '))
      .single()

    if (!error) return data as CRM_Servico
    if (isMissingTable(error)) throw missingTableError(table)

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (Object.prototype.hasOwnProperty.call(insertPayload, missing)) delete insertPayload[missing]
        const idx = cols.indexOf(missing)
        if (idx >= 0) cols.splice(idx, 1)
        continue
      }
    }

    throw error
  }

  throw new Error('Falha ao criar o serviço.')
}

export async function updateCrmServico(
  id: string,
  updates: Partial<Pick<CRM_Servico, 'integ_id' | 'descricao_serv' | 'obs_serv' | 'servicos_valor' | 'situacao_serv'>>
) {
  const table = 'crm_servicos'
  const cols = [
    'serv_id',
    'integ_id',
    'codigo_serv',
    'situacao_serv',
    'descricao_serv',
    'obs_serv',
    'servicos_valor',
    'criado_em',
    'atualizado_em'
  ]
  const updatePayload: any = { ...updates, atualizado_em: new Date().toISOString() }

  for (let i = 0; i < cols.length; i++) {
    const { data, error } = await sb
      .from(table)
      .update(updatePayload)
      .eq('serv_id', id)
      .select(cols.join(', '))
      .single()

    if (!error) return data as CRM_Servico
    if (isMissingTable(error)) throw missingTableError(table)

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (Object.prototype.hasOwnProperty.call(updatePayload, missing)) delete updatePayload[missing]
        const idx = cols.indexOf(missing)
        if (idx >= 0) cols.splice(idx, 1)
        continue
      }
    }

    throw error
  }

  throw new Error('Falha ao atualizar o serviço.')
}

export async function deleteCrmServico(id: string) {
  const { error } = await sb.from('crm_servicos').delete().eq('serv_id', id)
  if (error) throw error
}

export async function fetchCrmVerticais() {
  const { data, error } = await sb
    .from('crm_verticais')
    .select('vert_id, integ_id, descricao_vert, obs_ver, criado_em, atualizado_em')
    .order('descricao_vert', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar verticais:', error)
    return []
  }

  return data as CRM_Vertical[]
}

export async function createCrmVertical(payload: Pick<CRM_Vertical, 'integ_id' | 'descricao_vert' | 'obs_ver'>) {
  const { data, error } = await sb
    .from('crm_verticais')
    .insert({
      integ_id: payload.integ_id || null,
      descricao_vert: payload.descricao_vert,
      obs_ver: payload.obs_ver || null
    })
    .select('vert_id, integ_id, descricao_vert, obs_ver, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Vertical
}

export async function updateCrmVertical(id: string, updates: Partial<Pick<CRM_Vertical, 'integ_id' | 'descricao_vert' | 'obs_ver'>>) {
  const { data, error } = await sb
    .from('crm_verticais')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('vert_id', id)
    .select('vert_id, integ_id, descricao_vert, obs_ver, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Vertical
}

export async function deleteCrmVertical(id: string) {
  const { error } = await sb.from('crm_verticais').delete().eq('vert_id', id)
  if (error) throw error
}

export async function fetchCrmFases() {
  const q = sb
    .from('crm_fase')
    .select('fase_id, integ_id, fase_desc, fase_obs, fase_ordem, fase_cor, criado_em, atualizado_em')
    .order('fase_ordem', { ascending: true })
    .order('fase_desc', { ascending: true })

  const { data, error } = await q

  if (!error) return data as CRM_Fase[]

  if (isMissingTable(error)) {
    const legacy = await sb
      .from('crm_etapa')
      .select('etapa_id, integ_id, etapa_desc, etapa_obs, etapa_ordem, etapa_cor, criado_em, atualizado_em')
      .order('etapa_ordem', { ascending: true })
      .order('etapa_desc', { ascending: true })
    if (legacy.error) return []
    return (legacy.data || []).map((e: any) => ({
      fase_id: e.etapa_id,
      integ_id: e.integ_id,
      fase_desc: e.etapa_desc,
      fase_obs: e.etapa_obs,
      fase_ordem: e.etapa_ordem,
      fase_cor: e.etapa_cor,
      criado_em: e.criado_em,
      atualizado_em: e.atualizado_em
    })) as CRM_Fase[]
  }

  console.error('Erro ao buscar fases CRM:', error)
  return []
}

export async function createCrmFase(
  payload: Pick<CRM_Fase, 'integ_id' | 'fase_desc' | 'fase_obs' | 'fase_ordem' | 'fase_cor'>
) {
  const { data, error } = await sb
    .from('crm_fase')
    .insert({
      integ_id: payload.integ_id || null,
      fase_desc: payload.fase_desc,
      fase_obs: payload.fase_obs || null,
      fase_ordem: payload.fase_ordem ?? 0,
      fase_cor: payload.fase_cor || null
    })
    .select('fase_id, integ_id, fase_desc, fase_obs, fase_ordem, fase_cor, criado_em, atualizado_em')
    .single()

  if (error) {
    if (isMissingTable(error)) {
      const legacy = await sb
        .from('crm_etapa')
        .insert({
          integ_id: payload.integ_id || null,
          etapa_desc: payload.fase_desc,
          etapa_obs: payload.fase_obs || null,
          etapa_ordem: payload.fase_ordem ?? 0,
          etapa_cor: payload.fase_cor || null
        })
        .select('etapa_id, integ_id, etapa_desc, etapa_obs, etapa_ordem, etapa_cor, criado_em, atualizado_em')
        .single()
      if (legacy.error) throw legacy.error
      const e: any = legacy.data
      return {
        fase_id: e.etapa_id,
        integ_id: e.integ_id,
        fase_desc: e.etapa_desc,
        fase_obs: e.etapa_obs,
        fase_ordem: e.etapa_ordem,
        fase_cor: e.etapa_cor,
        criado_em: e.criado_em,
        atualizado_em: e.atualizado_em
      } as CRM_Fase
    }
    const mapped = mapCrmFaseConstraintError(error)
    if (mapped) throw mapped
    throw error
  }
  return data as CRM_Fase
}

export async function updateCrmFase(
  id: string,
  updates: Partial<Pick<CRM_Fase, 'integ_id' | 'fase_desc' | 'fase_obs' | 'fase_ordem' | 'fase_cor'>>
) {
  const { data, error } = await sb
    .from('crm_fase')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('fase_id', id)
    .select('fase_id, integ_id, fase_desc, fase_obs, fase_ordem, fase_cor, criado_em, atualizado_em')
    .single()

  if (error) {
    if (isMissingTable(error)) {
      const legacyUpdates: any = { atualizado_em: new Date().toISOString() }
      if (updates.integ_id !== undefined) legacyUpdates.integ_id = updates.integ_id
      if (updates.fase_desc !== undefined) legacyUpdates.etapa_desc = updates.fase_desc
      if (updates.fase_obs !== undefined) legacyUpdates.etapa_obs = updates.fase_obs
      if (updates.fase_ordem !== undefined) legacyUpdates.etapa_ordem = updates.fase_ordem
      if (updates.fase_cor !== undefined) legacyUpdates.etapa_cor = updates.fase_cor

      const legacy = await sb
        .from('crm_etapa')
        .update(legacyUpdates)
        .eq('etapa_id', id)
        .select('etapa_id, integ_id, etapa_desc, etapa_obs, etapa_ordem, etapa_cor, criado_em, atualizado_em')
        .single()
      if (legacy.error) throw legacy.error
      const e: any = legacy.data
      return {
        fase_id: e.etapa_id,
        integ_id: e.integ_id,
        fase_desc: e.etapa_desc,
        fase_obs: e.etapa_obs,
        fase_ordem: e.etapa_ordem,
        fase_cor: e.etapa_cor,
        criado_em: e.criado_em,
        atualizado_em: e.atualizado_em
      } as CRM_Fase
    }
    const mapped = mapCrmFaseConstraintError(error)
    if (mapped) throw mapped
    throw error
  }
  return data as CRM_Fase
}

export async function deleteCrmFase(id: string) {
  const { error } = await sb.from('crm_fase').delete().eq('fase_id', id)
  if (error) {
    if (isMissingTable(error)) {
      const legacy = await sb.from('crm_etapa').delete().eq('etapa_id', id)
      if (legacy.error) throw legacy.error
      return
    }
    throw error
  }
}

export const fetchCrmEtapas = fetchCrmFases
export const createCrmEtapa = async (payload: any) =>
  createCrmFase({
    ...payload,
    fase_desc: payload?.etapa_desc ?? payload?.fase_desc,
    fase_obs: payload?.etapa_obs ?? payload?.fase_obs,
    fase_ordem: payload?.etapa_ordem ?? payload?.fase_ordem,
    fase_cor: payload?.etapa_cor ?? payload?.fase_cor
  })
export const updateCrmEtapa = async (id: string, payload: any) =>
  updateCrmFase(id, {
    ...payload,
    fase_desc: payload?.etapa_desc ?? payload?.fase_desc,
    fase_obs: payload?.etapa_obs ?? payload?.fase_obs,
    fase_ordem: payload?.etapa_ordem ?? payload?.fase_ordem,
    fase_cor: payload?.etapa_cor ?? payload?.fase_cor
  })
export const deleteCrmEtapa = deleteCrmFase

export async function fetchCrmStatus() {
  const { data, error } = await sb
    .from('crm_status')
    .select('status_id, integ_id, status_desc, status_obs, status_ordem, status_cor, criado_em, atualizado_em')
    .order('status_ordem', { ascending: true })
    .order('status_desc', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar status CRM:', error)
    return []
  }

  return data as CRM_Status[]
}

export async function createCrmStatus(
  payload: Pick<CRM_Status, 'integ_id' | 'status_desc' | 'status_obs' | 'status_ordem' | 'status_cor'>
) {
  const { data, error } = await sb
    .from('crm_status')
    .insert({
      integ_id: payload.integ_id || null,
      status_desc: payload.status_desc,
      status_obs: payload.status_obs || null,
      status_ordem: payload.status_ordem ?? 0,
      status_cor: payload.status_cor || null
    })
    .select('status_id, integ_id, status_desc, status_obs, status_ordem, status_cor, criado_em, atualizado_em')
    .single()

  if (error) {
    if (isMissingTable(error)) throw missingTableError('public.crm_status')
    const mapped = mapCrmStatusConstraintError(error)
    if (mapped) throw mapped
    throw error
  }
  return data as CRM_Status
}

export async function updateCrmStatus(
  id: string,
  updates: Partial<Pick<CRM_Status, 'integ_id' | 'status_desc' | 'status_obs' | 'status_ordem' | 'status_cor'>>
) {
  const { data, error } = await sb
    .from('crm_status')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('status_id', id)
    .select('status_id, integ_id, status_desc, status_obs, status_ordem, status_cor, criado_em, atualizado_em')
    .single()

  if (error) {
    if (isMissingTable(error)) throw missingTableError('public.crm_status')
    const mapped = mapCrmStatusConstraintError(error)
    if (mapped) throw mapped
    throw error
  }
  return data as CRM_Status
}

export async function deleteCrmStatus(id: string) {
  const { error } = await sb.from('crm_status').delete().eq('status_id', id)
  if (error) {
    if (isMissingTable(error)) throw missingTableError('public.crm_status')
    throw error
  }
}
