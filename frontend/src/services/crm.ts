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
  solucao: 'PRODUTO' | 'SERVICO' | null
  obs_oport: string | null
  descricao_oport: string | null
  qts_item: number | null
  prev_entrega: string | null
  temperatura: number | null
  cod_produto: string | null
  cod_servico: string | null
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

/* ======================================================
   OPORTUNIDADES (LEVE E RÁPIDO)
====================================================== */
export async function fetchOportunidades(opts?: { orderDesc?: boolean }) {
  const orderDesc = opts?.orderDesc ?? true
  const baseV2 = `
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

  const wideV2 = `${baseV2},
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
    const q = (supabase as any)
      .from('crm_oportunidades')
      .select(baseV2)
      .order('data_inclusao', { ascending: !orderDesc })
    const r = await q
    if (!r.error) return (r.data || []) as CRM_Oportunidade[]
    if (r.error.code === '42P01') return []
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
  const q = (supabase as any)
    .from('crm_oportunidades')
    .update(updates)
    .eq('id_oport', id)
    .select()
    .single()

  const { data, error } = await q

  if (error) {
    if (error.code === '42P01') throw new Error('Tabela crm_oportunidades ainda não foi criada.')
    const msg = String(error.message || '')
    const isMissingColumn =
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      (msg.includes('Could not find') && msg.toLowerCase().includes('column')) ||
      (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('schema cache'))
    if (isMissingColumn) {
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

      const msg2 = String(r2.error?.message || '')
      const isMissingColumn2 =
        r2.error?.code === 'PGRST204' ||
        r2.error?.code === '42703' ||
        (msg2.includes('Could not find') && msg2.toLowerCase().includes('column')) ||
        (msg2.toLowerCase().includes('column') && msg2.toLowerCase().includes('schema cache'))

      if (isMissingColumn2 && stageLabel !== undefined) {
        const q3 = (supabase as any)
          .from('crm_oportunidades')
          .update({ ...rest, etapa: stageLabel })
          .eq('id_oportunidade', id)
          .select()
          .single()
        const r3 = await q3
        if (r3.error) throw r3.error
        return { ...(r3.data as any), fase: (r3.data as any)?.etapa ?? null } as CRM_Oportunidade
      }

      throw r2.error
    }
    throw error
  }
  return data as CRM_Oportunidade
}

export async function createOportunidade(payload: Partial<CRM_Oportunidade>) {
  const q = (supabase as any)
    .from('crm_oportunidades')
    .insert(payload)
    .select()
    .single()

  const { data, error } = await q
  if (error) {
    if (error.code === '42P01') throw new Error('Tabela crm_oportunidades ainda não foi criada.')
    throw error
  }
  return data as CRM_Oportunidade
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
  descricao_prod: string
  obs_prod: string | null
  produto_valor: number | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Servico {
  serv_id: string
  integ_id: string | null
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

const isMissingTable = (error: any) => {
  const code = error?.code
  if (code === '42P01') return true
  if (code === 'PGRST205') return true
  const msg = String(error?.message || '')
  return msg.includes('schema cache') && msg.includes('Could not find the table')
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
  const { data, error } = await sb
    .from('crm_produtos')
    .select('prod_id, integ_id, descricao_prod, obs_prod, produto_valor, criado_em, atualizado_em')
    .order('descricao_prod', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar produtos:', error)
    return []
  }

  return data as CRM_Produto[]
}

export async function createCrmProduto(payload: Pick<CRM_Produto, 'integ_id' | 'descricao_prod' | 'obs_prod' | 'produto_valor'>) {
  const { data, error } = await sb
    .from('crm_produtos')
    .insert({
      integ_id: payload.integ_id || null,
      descricao_prod: payload.descricao_prod,
      obs_prod: payload.obs_prod || null,
      produto_valor: payload.produto_valor ?? 0
    })
    .select('prod_id, integ_id, descricao_prod, obs_prod, produto_valor, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Produto
}

export async function updateCrmProduto(
  id: string,
  updates: Partial<Pick<CRM_Produto, 'integ_id' | 'descricao_prod' | 'obs_prod' | 'produto_valor'>>
) {
  const { data, error } = await sb
    .from('crm_produtos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('prod_id', id)
    .select('prod_id, integ_id, descricao_prod, obs_prod, produto_valor, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Produto
}

export async function deleteCrmProduto(id: string) {
  const { error } = await sb.from('crm_produtos').delete().eq('prod_id', id)
  if (error) throw error
}

export async function fetchCrmServicos() {
  const { data, error } = await sb
    .from('crm_servicos')
    .select('serv_id, integ_id, descricao_serv, obs_serv, servicos_valor, criado_em, atualizado_em')
    .order('descricao_serv', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar serviços:', error)
    return []
  }

  return data as CRM_Servico[]
}

export async function createCrmServico(payload: Pick<CRM_Servico, 'integ_id' | 'descricao_serv' | 'obs_serv' | 'servicos_valor'>) {
  const { data, error } = await sb
    .from('crm_servicos')
    .insert({
      integ_id: payload.integ_id || null,
      descricao_serv: payload.descricao_serv,
      obs_serv: payload.obs_serv || null,
      servicos_valor: payload.servicos_valor ?? 0
    })
    .select('serv_id, integ_id, descricao_serv, obs_serv, servicos_valor, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Servico
}

export async function updateCrmServico(
  id: string,
  updates: Partial<Pick<CRM_Servico, 'integ_id' | 'descricao_serv' | 'obs_serv' | 'servicos_valor'>>
) {
  const { data, error } = await sb
    .from('crm_servicos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('serv_id', id)
    .select('serv_id, integ_id, descricao_serv, obs_serv, servicos_valor, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Servico
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
