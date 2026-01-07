import { supabase } from '../supabaseClient'

export interface CRM_Oportunidade {
  id_oportunidade: string
  cod_oportunidade: string | null
  cliente: string | null
  vendedor: string | null
  solucao: string | null
  origem: string | null
  fase_kanban: string | null
  status: string | null
  valor_proposta: string | null
  data: string | null
  data_inclusao: string | null
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
