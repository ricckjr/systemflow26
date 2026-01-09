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
