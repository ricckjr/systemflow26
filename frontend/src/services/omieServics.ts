import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database.types'

export type OmieServic = Database['public']['Tables']['omie_servics']['Row']

export async function fetchOmieServics(): Promise<OmieServic[]> {
  const { data, error } = await supabase
    .from('omie_servics')
    .select('*')
    .order('data_alteracao', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateOmieServicStatus(params: {
  id_omie: string
  status: string | null
  data_alteracao?: string
  etapa?: string | null
}): Promise<OmieServic> {
  const dataAlteracao = params.data_alteracao || new Date().toISOString()

  const { data, error } = await supabase
    .from('omie_servics')
    .update({
      status: params.status,
      etapa: params.etapa,
      data_alteracao: dataAlteracao,
    })
    .eq('id_omie', params.id_omie)
    .select('*')
    .single()

  if (error) throw error
  return data
}
