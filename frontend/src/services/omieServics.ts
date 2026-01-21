import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database.types'

export type OmieServic = Database['public']['Tables']['omie_servics']['Row']

export async function fetchOmieServics(): Promise<OmieServic[]> {
  const { data, error } = await supabase
    .from('omie_servics')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateOmieServicStatus(params: {
  id_omie: string
  status_proposta: string | null
  updated_at?: string
  id_etapa?: string | null
}): Promise<OmieServic> {
  const updatedAt = params.updated_at || new Date().toISOString()

  const { data, error } = await supabase
    .from('omie_servics')
    .update({
      status_proposta: params.status_proposta,
      id_etapa: params.id_etapa,
      updated_at: updatedAt,
    })
    .eq('id_omie', params.id_omie)
    .select('*')
    .single()

  if (error) throw error
  return data
}
