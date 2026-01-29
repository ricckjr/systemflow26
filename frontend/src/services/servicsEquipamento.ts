import { supabase } from '@/services/supabase'
import { ServicEquipamento } from '@/types/domain'

import { OS_PHASES, normalizeOsPhase, getOsPhaseConfig } from '@/config/ordemServicoKanbanConfig'

export const ETAPAS_SERVICOS = OS_PHASES

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

export async function updateServicEquipamentoFase(
  id: string,
  fase: string,
  responsavel?: string,
  servicosRealizados?: string,
  observacoes?: string
): Promise<ServicEquipamento> {
  const normalizedFase = normalizeOsPhase(fase)
  const { data: currentService } = await supabase
    .from('servics_equipamento')
    .select('fase, responsavel, id_rst')
    .eq('id', id)
    .single()

  const updates: any = {
    fase: normalizedFase,
    updated_at: new Date().toISOString()
  }
  
  // Atualizar timestamp da fase se mudou
  if (currentService && currentService.fase !== normalizedFase) {
    updates.data_fase_atual = new Date().toISOString()
  }
  
  if (responsavel !== undefined) {
    updates.responsavel = responsavel
  }
  
  if (normalizedFase === 'FINALIZADO') {
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
  if (currentService && (currentService.fase !== normalizedFase || (responsavel !== undefined && currentService.responsavel !== responsavel))) {
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      service_id: id,
      fase_origem: currentService.fase,
      fase_destino: normalizedFase,
      responsavel_origem: currentService.responsavel,
      responsavel_destino: responsavel !== undefined ? responsavel : currentService.responsavel,
      alterado_por: user?.id,
      data_movimentacao: new Date().toISOString(),
      servicos_realizados: servicosRealizados?.trim() ? servicosRealizados.trim() : null,
      observacoes: observacoes?.trim() ? observacoes.trim() : null,
      descricao: servicosRealizados?.trim() ? servicosRealizados.trim() : null
    }

    const { error: historicoError } = await supabase.from('servics_historico').insert(payload)
    if (historicoError) {
      const code = (historicoError as any)?.code as string | undefined
      const message = (historicoError as any)?.message as string | undefined
      if (code === 'PGRST204' && message?.toLowerCase().includes('schema cache')) {
        throw new Error(
          `Seu Supabase ainda não reconhece uma ou mais colunas do histórico (schema cache desatualizado). ` +
            `Aplique a migration mais recente em public.servics_historico e recarregue o schema do PostgREST (ou aguarde alguns minutos). ` +
            `Detalhe: ${message}`
        )
      }
      throw historicoError
    }

    const resolveProfileId = async (nome?: string | null, email?: string | null): Promise<string | null> => {
      const cleanName = String(nome || '').trim()
      if (cleanName.length) {
        const { data: byName } = await supabase.from('profiles').select('id').eq('nome', cleanName).maybeSingle()
        if (byName?.id) return byName.id
      }

      const cleanEmail = String(email || '').trim()
      if (!cleanEmail.length) return null

      const { data: byEmailLogin } = await supabase.from('profiles').select('id').eq('email_login', cleanEmail).maybeSingle()
      if (byEmailLogin?.id) return byEmailLogin.id

      const { data: byEmailCorporate } = await supabase.from('profiles').select('id').eq('email_corporativo', cleanEmail).maybeSingle()
      if (byEmailCorporate?.id) return byEmailCorporate.id

      return null
    }

    const faseLabel = getOsPhaseConfig(normalizedFase).label
    const respNome = responsavel !== undefined ? responsavel : currentService.responsavel
    const sellerNome = (data as any)?.vendedor as string | null | undefined
    const sellerEmail = (data as any)?.email_vendedor as string | null | undefined

    const recipientIds = new Set<string>()

    const responsibleId = await resolveProfileId(respNome ?? null, null)
    if (responsibleId) recipientIds.add(responsibleId)

    const sellerId = await resolveProfileId(sellerNome ?? null, sellerEmail ?? null)
    if (sellerId) recipientIds.add(sellerId)

    if (recipientIds.size > 0) {
      const obsText = observacoes?.trim() ? `\nObservações: ${observacoes.trim()}` : ''
      const content =
        `A OS ${currentService.id_rst} foi movida para ${faseLabel}.\n` +
        `Responsável: ${String(respNome || '-').trim() || '-'}\n` +
        `Serviços: ${servicosRealizados?.trim() || '-'}` +
        obsText

      await supabase.from('notifications').insert(
        Array.from(recipientIds).map((user_id) => ({
          user_id,
          title: `OS ${currentService.id_rst} - Nova Fase`,
          content,
          link: '/app/producao/ordens-servico',
          type: 'info',
          is_read: false
        }))
      )
    }
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

export async function updateServicEquipamentoDetalhes(
  id: string,
  updates: Partial<
    Pick<
      ServicEquipamento,
      | 'modelo'
      | 'fabricante'
      | 'numero_serie'
      | 'tag'
      | 'faixa'
      | 'garantia'
      | 'numero_nf'
      | 'numero_pedido'
      | 'observacoes_equipamento'
      | 'numero_certificado'
      | 'data_calibracao'
      | 'responsavel'
    >
  > & {
    numero_serie2?: string | null
  }
): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as ServicEquipamento
}

export async function updateServicEquipamentoAnexos(id: string, anexos: unknown[] | null): Promise<ServicEquipamento> {
  const { data, error } = await supabase
    .from('servics_equipamento')
    .update({
      anexos,
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
