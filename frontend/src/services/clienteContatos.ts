import { supabase } from '@/services/supabase'

export interface ClienteContato {
  contato_id: string
  integ_id: string | null
  cliente_id: string
  contato_nome: string
  contato_cargo: string | null
  contato_telefone01: string | null
  contato_telefone02: string | null
  contato_email: string | null
  user_id: string | null
  contato_obs: string | null
  data_inclusao: string
  data_atualizacao: string
  deleted_at: string | null
}

export type CreateClienteContatoPayload = Omit<ClienteContato, 'contato_id' | 'data_inclusao' | 'data_atualizacao'>
export type UpdateClienteContatoPayload = Partial<Omit<ClienteContato, 'contato_id' | 'cliente_id' | 'user_id' | 'data_inclusao' | 'data_atualizacao'>>

const normalizeDigits = (value: string) => (value || '').replace(/\D/g, '').trim()

export async function fetchClienteContatos(clienteId: string) {
  const sb = supabase as any
  const { data, error } = await sb
    .from('crm_contatos')
    .select(
      `
      contato_id,
      integ_id,
      cliente_id,
      contato_nome,
      contato_cargo,
      contato_telefone01,
      contato_telefone02,
      contato_email,
      user_id,
      contato_obs,
      data_inclusao,
      data_atualizacao,
      deleted_at
    `
    )
    .eq('cliente_id', clienteId)
    .is('deleted_at', null)
    .order('data_inclusao', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    console.error('Erro ao buscar contatos do cliente:', error)
    return []
  }

  return data as ClienteContato[]
}

export async function fetchContatoById(contatoId: string) {
  const id = (contatoId || '').trim()
  if (!id) return null
  const sb = supabase as any
  const { data, error } = await sb
    .from('crm_contatos')
    .select(
      `
      contato_id,
      integ_id,
      cliente_id,
      contato_nome,
      contato_cargo,
      contato_telefone01,
      contato_telefone02,
      contato_email,
      user_id,
      contato_obs,
      data_inclusao,
      data_atualizacao,
      deleted_at
    `
    )
    .eq('contato_id', id)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') return null
    console.error('Erro ao buscar contato por ID:', error)
    return null
  }
  if (!data) return null
  if (data.deleted_at) return null
  return data as ClienteContato
}

export async function createClienteContato(payload: CreateClienteContatoPayload) {
  const sb = supabase as any
  const { data, error } = await sb
    .from('crm_contatos')
    .insert({
      ...payload,
      contato_email: payload.contato_email ? payload.contato_email.trim().toLowerCase() : null,
      contato_telefone01: payload.contato_telefone01 ? normalizeDigits(payload.contato_telefone01) : null,
      contato_telefone02: payload.contato_telefone02 ? normalizeDigits(payload.contato_telefone02) : null
    })
    .select(
      `
      contato_id,
      integ_id,
      cliente_id,
      contato_nome,
      contato_cargo,
      contato_telefone01,
      contato_telefone02,
      contato_email,
      user_id,
      contato_obs,
      data_inclusao,
      data_atualizacao,
      deleted_at
    `
    )
    .single()

  if (error) throw error
  return data as ClienteContato
}

export async function updateClienteContato(contatoId: string, updates: UpdateClienteContatoPayload) {
  const sb = supabase as any
  const { data, error } = await sb
    .from('crm_contatos')
    .update({
      ...updates,
      contato_email: updates.contato_email ? String(updates.contato_email).trim().toLowerCase() : updates.contato_email,
      contato_telefone01: updates.contato_telefone01 ? normalizeDigits(String(updates.contato_telefone01)) : updates.contato_telefone01,
      contato_telefone02: updates.contato_telefone02 ? normalizeDigits(String(updates.contato_telefone02)) : updates.contato_telefone02
    })
    .eq('contato_id', contatoId)
    .select(
      `
      contato_id,
      integ_id,
      cliente_id,
      contato_nome,
      contato_cargo,
      contato_telefone01,
      contato_telefone02,
      contato_email,
      user_id,
      contato_obs,
      data_inclusao,
      data_atualizacao,
      deleted_at
    `
    )
    .single()

  if (error) throw error
  return data as ClienteContato
}
