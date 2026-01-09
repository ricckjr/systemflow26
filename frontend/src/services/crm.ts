import { supabase } from '@/services/supabase'

export interface CRM_Oportunidade {
  id_oportunidade: string
  cod_oportunidade: string | null
  cliente: string | null
  nome_contato: string | null
  vendedor: string | null
  solucao: string | null
  origem: string | null
  fase_kanban: string | null
  status: string | null
  temperatura: number | null
  valor_proposta: string | null
  data: string | null
  data_inclusao: string | null
  dias_abertos: number | null
  observacoes_vendedor: string | null
  system_nota: string | null
  descricao_oportunidade: string | null
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
