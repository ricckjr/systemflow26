import { supabase } from '@/services/supabase'

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

export async function fetchOportunidades(opts?: { orderDesc?: boolean }) {
  const orderDesc = opts?.orderDesc ?? true
  const { data, error } = await supabase
    .from('crm_oportunidades')
    .select('*')
    .order('data_inclusao', { ascending: !orderDesc })
  if (error) throw error
  return data as CRM_Oportunidade[] || []
}

export const isVenda = (s?: string | null) =>
  ['CONQUISTADO', 'FATURADO', 'GANHO', 'VENDIDO'].includes((s || '').trim().toUpperCase())

export const isAtivo = (s?: string | null) =>
  !['CANCELADO', 'PERDIDO', 'FATURADO', 'CONQUISTADO', 'GANHO', 'VENDIDO'].includes(
    (s || '').trim().toUpperCase()
  )

export interface CRM_Ligacao {
  id: string
  data_hora: string
  vendedor: string | null
  resultado: string | null
}

export async function fetchLigacoes() {
  const { data, error } = await supabase
    .from('crm_ligacoes')
    .select('id, data_hora, vendedor, resultado')
    .order('data_hora', { ascending: false })
  
  if (error) {
    // Se a tabela não existir (ainda), retorna vazio silenciosamente para não quebrar o dashboard
    if (error.code === '42P01') return [] 
    console.error('Erro ao buscar ligações:', error)
    return []
  }
  return data as CRM_Ligacao[]
}

export interface CRM_Meta {
  id: number
  meta_valor_financeiro: number
  supermeta_valor_financeiro: number
  meta_novas_oportunidades: number
  meta_ligacoes: number
  tempo_ligacoes: number | null
  meta_geral: number | null
}

export async function fetchMeta() {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Erro ao buscar metas:', error)
    return null
  }
  return data as CRM_Meta
}

export async function createMeta(meta: Omit<CRM_Meta, 'id'>) {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .insert([meta])
    .select()
    .single()

  if (error) throw error
  return data as CRM_Meta
}

export async function updateMeta(id: number, updates: Partial<CRM_Meta>) {
  const { data, error } = await supabase
    .from('crm_meta_comercial')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CRM_Meta
}
