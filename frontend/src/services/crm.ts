import { supabase } from '@/services/supabase'

/* ======================================================
   TIPOS
====================================================== */
export interface CRM_Oportunidade {
  id_oportunidade: string
  cod_oportunidade: string | null
  cliente: string | null
  nome_contato: string | null
  telefone01_contato: string | null
  telefone02_contato: string | null
  email: string | null
  id_vendedor: string | null
  vendedor: string | null
  solucao: string | null
  origem: string | null
  etapa: string | null
  status: string | null
  temperatura: number | null
  valor_proposta: string | null
  descricao_oportunidade: string | null
  observacoes_vendedor: string | null
  empresa_correspondente: string | null
  data_inclusao: string | null
  data: string | null
  dias_abertos: number | null
  dias_parado: number | null
  criado_em: string | null
  atualizado_em: string | null
  system_nota: string | null
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

  const { data, error } = await supabase
    .from('crm_oportunidades')
    .select(`
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
      etapa,
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
      system_nota
    `)
    .order('data_inclusao', { ascending: !orderDesc })

  if (error) {
    console.error('Erro ao buscar oportunidades:', error)
    return []
  }

  return data as CRM_Oportunidade[]
}

export async function updateOportunidade(id: string, updates: Partial<CRM_Oportunidade>) {
  const { data, error } = await supabase
    .from('crm_oportunidades')
    .update(updates)
    .eq('id_oportunidade', id)
    .select()
    .single()

  if (error) throw error
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
  id_motiv: string
  id_integ: string | null
  descricao_motiv: string
  obs_motiv: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_OrigemLead {
  id_orig: string
  id_integ: string | null
  descricao_orig: string
  obs_orig: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Produto {
  id_prod: string
  id_integ: string | null
  descricao_prod: string
  obs_prod: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Servico {
  id_serv: string
  id_integ: string | null
  descricao_serv: string
  obs_serv: string | null
  criado_em: string | null
  atualizado_em: string | null
}

export interface CRM_Vertical {
  id_vert: string
  id_integ: string | null
  descricao_vert: string
  obs_ver: string | null
  criado_em: string | null
  atualizado_em: string | null
}

const isMissingTable = (error: any) => error?.code === '42P01'
const sb = supabase as any

export async function fetchCrmMotivos() {
  const { data, error } = await sb
    .from('crm_motivos')
    .select('id_motiv, id_integ, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .order('descricao_motiv', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar motivos:', error)
    return []
  }

  return data as CRM_Motivo[]
}

export async function createCrmMotivo(payload: Pick<CRM_Motivo, 'id_integ' | 'descricao_motiv' | 'obs_motiv'>) {
  const { data, error } = await sb
    .from('crm_motivos')
    .insert({
      id_integ: payload.id_integ || null,
      descricao_motiv: payload.descricao_motiv,
      obs_motiv: payload.obs_motiv || null
    })
    .select('id_motiv, id_integ, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Motivo
}

export async function updateCrmMotivo(id: string, updates: Partial<Pick<CRM_Motivo, 'id_integ' | 'descricao_motiv' | 'obs_motiv'>>) {
  const { data, error } = await sb
    .from('crm_motivos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id_motiv', id)
    .select('id_motiv, id_integ, descricao_motiv, obs_motiv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Motivo
}

export async function deleteCrmMotivo(id: string) {
  const { error } = await sb.from('crm_motivos').delete().eq('id_motiv', id)
  if (error) throw error
}

export async function fetchCrmOrigensLead() {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .select('id_orig, id_integ, descricao_orig, obs_orig, criado_em, atualizado_em')
    .order('descricao_orig', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar origens de leads:', error)
    return []
  }

  return data as CRM_OrigemLead[]
}

export async function createCrmOrigemLead(payload: Pick<CRM_OrigemLead, 'id_integ' | 'descricao_orig' | 'obs_orig'>) {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .insert({
      id_integ: payload.id_integ || null,
      descricao_orig: payload.descricao_orig,
      obs_orig: payload.obs_orig || null
    })
    .select('id_orig, id_integ, descricao_orig, obs_orig, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_OrigemLead
}

export async function updateCrmOrigemLead(id: string, updates: Partial<Pick<CRM_OrigemLead, 'id_integ' | 'descricao_orig' | 'obs_orig'>>) {
  const { data, error } = await sb
    .from('crm_origem_leads')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id_orig', id)
    .select('id_orig, id_integ, descricao_orig, obs_orig, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_OrigemLead
}

export async function deleteCrmOrigemLead(id: string) {
  const { error } = await sb.from('crm_origem_leads').delete().eq('id_orig', id)
  if (error) throw error
}

export async function fetchCrmProdutos() {
  const { data, error } = await sb
    .from('crm_produtos')
    .select('id_prod, id_integ, descricao_prod, obs_prod, criado_em, atualizado_em')
    .order('descricao_prod', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar produtos:', error)
    return []
  }

  return data as CRM_Produto[]
}

export async function createCrmProduto(payload: Pick<CRM_Produto, 'id_integ' | 'descricao_prod' | 'obs_prod'>) {
  const { data, error } = await sb
    .from('crm_produtos')
    .insert({
      id_integ: payload.id_integ || null,
      descricao_prod: payload.descricao_prod,
      obs_prod: payload.obs_prod || null
    })
    .select('id_prod, id_integ, descricao_prod, obs_prod, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Produto
}

export async function updateCrmProduto(id: string, updates: Partial<Pick<CRM_Produto, 'id_integ' | 'descricao_prod' | 'obs_prod'>>) {
  const { data, error } = await sb
    .from('crm_produtos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id_prod', id)
    .select('id_prod, id_integ, descricao_prod, obs_prod, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Produto
}

export async function deleteCrmProduto(id: string) {
  const { error } = await sb.from('crm_produtos').delete().eq('id_prod', id)
  if (error) throw error
}

export async function fetchCrmServicos() {
  const { data, error } = await sb
    .from('crm_servicos')
    .select('id_serv, id_integ, descricao_serv, obs_serv, criado_em, atualizado_em')
    .order('descricao_serv', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar serviços:', error)
    return []
  }

  return data as CRM_Servico[]
}

export async function createCrmServico(payload: Pick<CRM_Servico, 'id_integ' | 'descricao_serv' | 'obs_serv'>) {
  const { data, error } = await sb
    .from('crm_servicos')
    .insert({
      id_integ: payload.id_integ || null,
      descricao_serv: payload.descricao_serv,
      obs_serv: payload.obs_serv || null
    })
    .select('id_serv, id_integ, descricao_serv, obs_serv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Servico
}

export async function updateCrmServico(id: string, updates: Partial<Pick<CRM_Servico, 'id_integ' | 'descricao_serv' | 'obs_serv'>>) {
  const { data, error } = await sb
    .from('crm_servicos')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id_serv', id)
    .select('id_serv, id_integ, descricao_serv, obs_serv, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Servico
}

export async function deleteCrmServico(id: string) {
  const { error } = await sb.from('crm_servicos').delete().eq('id_serv', id)
  if (error) throw error
}

export async function fetchCrmVerticais() {
  const { data, error } = await sb
    .from('crm_verticais')
    .select('id_vert, id_integ, descricao_vert, obs_ver, criado_em, atualizado_em')
    .order('descricao_vert', { ascending: true })

  if (error) {
    if (isMissingTable(error)) return []
    console.error('Erro ao buscar verticais:', error)
    return []
  }

  return data as CRM_Vertical[]
}

export async function createCrmVertical(payload: Pick<CRM_Vertical, 'id_integ' | 'descricao_vert' | 'obs_ver'>) {
  const { data, error } = await sb
    .from('crm_verticais')
    .insert({
      id_integ: payload.id_integ || null,
      descricao_vert: payload.descricao_vert,
      obs_ver: payload.obs_ver || null
    })
    .select('id_vert, id_integ, descricao_vert, obs_ver, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Vertical
}

export async function updateCrmVertical(id: string, updates: Partial<Pick<CRM_Vertical, 'id_integ' | 'descricao_vert' | 'obs_ver'>>) {
  const { data, error } = await sb
    .from('crm_verticais')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id_vert', id)
    .select('id_vert, id_integ, descricao_vert, obs_ver, criado_em, atualizado_em')
    .single()

  if (error) throw error
  return data as CRM_Vertical
}

export async function deleteCrmVertical(id: string) {
  const { error } = await sb.from('crm_verticais').delete().eq('id_vert', id)
  if (error) throw error
}
