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
