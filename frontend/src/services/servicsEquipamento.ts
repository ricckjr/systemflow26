import { supabase } from '@/services/supabase'
import { ServicEquipamento } from '@/types/domain'

export const ETAPAS_SERVICOS = [
  'ANALISE',
  'LABORATORIO',
  'OFICINA',
  'LAVADOR',
  'PINTURA',
  'ELETRONICA',
  'EMBALAGEM',
  'FINALIZADO'
] as const

export async function getServicsEquipamentos(): Promise<ServicEquipamento[]> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as ServicEquipamento[]) || []
}

export async function getServicsEquipamentosByProposal(codProposta: string): Promise<ServicEquipamento[]> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .select('*')
    .eq('cod_proposta', codProposta)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as ServicEquipamento[]) || []
}

export async function createServicEquipamento(service: Omit<ServicEquipamento, 'id' | 'id_rst' | 'created_at' | 'updated_at'>): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .insert(service)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoEtapa(id: string, etapa: string): Promise<ServicEquipamento> {
  const updates: any = {
    etapa,
    updated_at: new Date().toISOString()
  }
  
  if (etapa === 'FINALIZADO') {
    updates.data_finalizada = new Date().toISOString()
  } else {
    updates.data_finalizada = null // Reset if moved back
  }

  const { data, error } = await supabase
    .from('servics_equipamento')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function uploadEquipmentImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `${fileName}`
  
  // Try 'production-files' first, fallback to 'task-attachments' if not found
  const bucketName = 'production-files'
  
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file)

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath)

  return data.publicUrl
}
