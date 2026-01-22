import { supabase } from '@/services/supabase'
import { ServicEquipamento } from '@/types/domain'

export const ETAPAS_SERVICOS = [
  'ANALISE',
  'AGUARDANDO CLIENTE',
  'CALIBRACAO',
  'LAVADOR',
  'PREPARO-PINTURA',
  'ELETRONICA',
  'PREPARO FINAL',
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

  if (error) {
    const code = (error as any)?.code as string | undefined
    const message = (error as any)?.message as string | undefined
    if (code === 'PGRST204' && message?.toLowerCase().includes('schema cache')) {
      throw new Error(
        `Seu Supabase ainda não reconhece uma ou mais colunas enviadas (schema cache desatualizado). ` +
          `Aplique a migration mais recente em public.servics_equipamento e recarregue o schema do PostgREST (ou aguarde alguns minutos). ` +
          `Detalhe: ${message}`
      )
    }
    throw error
  }
  return data as ServicEquipamento
}

export async function updateServicEquipamentoFase(id: string, fase: string, responsavel?: string): Promise<ServicEquipamento> {
  const { data: currentService } = await supabase
    .from('servics_equipamento')
    .select('fase, responsavel')
    .eq('id', id)
    .single()

  const updates: any = {
    fase,
    updated_at: new Date().toISOString()
  }
  
  if (responsavel !== undefined) {
    updates.responsavel = responsavel
  }
  
  if (fase === 'FINALIZADO') {
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

  // Registrar histórico se houve mudança
  if (currentService && (currentService.fase !== fase || (responsavel !== undefined && currentService.responsavel !== responsavel))) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('servics_historico').insert({
      service_id: id,
      fase_origem: currentService.fase,
      fase_destino: fase,
      responsavel_origem: currentService.responsavel,
      responsavel_destino: responsavel !== undefined ? responsavel : currentService.responsavel,
      alterado_por: user?.id,
      data_movimentacao: new Date().toISOString()
    })
  }

  return data as ServicEquipamento
}

export async function getServicHistorico(serviceId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('servics_historico')
    .select(`
      *,
      profiles:alterado_por (nome)
    `)
    .eq('service_id', serviceId)
    .order('data_movimentacao', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateServicEquipamentoEtapaOmie(codProposta: string, etapaOmie: string): Promise<void> {
  const { error } = await supabase
    .from('servics_equipamento')
    .update({ 
      etapa_omie: etapaOmie,
      updated_at: new Date().toISOString()
    })
    .eq('cod_proposta', codProposta)

  if (error) throw error
}

export async function updateServicEquipamentoAnaliseVisual(id: string, analiseVisual: string | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({ 
      observacoes_equipamento: analiseVisual,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoTestesRealizados(id: string, testesRealizados: string | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({ 
      testes_realizados: testesRealizados,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoServicosAFazer(id: string, servicosAFazer: string | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({ 
      servicos_a_fazer: servicosAFazer,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoCertificadoCalibracao(id: string, numeroCertificado: string | null, dataCalibracao: string | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({ 
      numero_certificado: numeroCertificado,
      data_calibracao: dataCalibracao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoImagens(id: string, imagens: string[] | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({ 
      imagens,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function uploadEquipmentImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const safeBaseName = (file.name || 'arquivo')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
  const uniquePrefix = Math.random().toString(36).substring(2)
  const fileName = `${uniquePrefix}_${safeBaseName}${fileExt ? '' : '.bin'}`
  const filePath = fileName
  
  const bucketCandidates = ['production-files', 'task-attachments']
  let uploadedBucket: string | null = null

  for (const bucketName of bucketCandidates) {
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file)

    if (!uploadError) {
      uploadedBucket = bucketName
      break
    }
  }

  if (!uploadedBucket) {
    throw new Error('Falha ao enviar arquivo para o Storage.')
  }

  const { data } = supabase.storage
    .from(uploadedBucket)
    .getPublicUrl(filePath)

  return data.publicUrl
}
