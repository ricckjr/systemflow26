import { supabase } from '@/services/supabase'

export type ClienteTipoPessoa = 'FISICA' | 'JURIDICA'
export type ClienteRegimeTributario = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'

export interface Cliente {
  cliente_id: string
  integ_id: string | null
  cliente_nome_razao_social: string
  cliente_nome_fantasia: string | null
  cliente_documento: string | null
  cliente_documento_formatado: string | null
  cliente_tipo_pessoa: ClienteTipoPessoa
  cliente_vertical: string | null
  cliente_email: string | null
  cliente_telefone: string | null
  cliente_cep: string | null
  cliente_endereco: string | null
  cliente_numero: string | null
  cliente_complemento: string | null
  cliente_bairro: string | null
  cliente_cidade: string | null
  cliente_uf: string | null
  cliente_pais: string | null
  cliente_ibge: string | null
  cliente_cnae: string | null
  cliente_inscricao_estadual: string | null
  cliente_inscricao_municipal: string | null
  cliente_optante_simples_nacional: boolean | null
  cliente_regime_tributario: ClienteRegimeTributario | null
  cliente_website: string | null
  cliente_instagram: string | null
  cliente_facebook: string | null
  cliente_linkedin: string | null
  cliente_origem_lead: string | null
  cliente_tags: string[] | null
  cliente_observacoes: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CreateClientePayload = Omit<
  Cliente,
  'cliente_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'cliente_documento_formatado' | 'user_id'
> & { deleted_at?: null; user_id?: string | null }

export type UpdateClientePayload = Partial<
  Omit<Cliente, 'cliente_id' | 'created_at' | 'updated_at' | 'cliente_documento_formatado'>
>

const normalizeDigits = (value: string) => (value || '').replace(/\D/g, '').trim()

export async function fetchClientes(opts?: { search?: string; includeDeleted?: boolean }) {
  const sb = supabase as any
  const includeDeleted = opts?.includeDeleted ?? false
  const search = (opts?.search || '').trim()

  let q = sb
    .from('crm_clientes')
    .select(
      `
      cliente_id,
      integ_id,
      cliente_nome_razao_social,
      cliente_nome_fantasia,
      cliente_documento,
      cliente_documento_formatado,
      cliente_tipo_pessoa,
      cliente_vertical,
      cliente_email,
      cliente_telefone,
      cliente_cep,
      cliente_endereco,
      cliente_numero,
      cliente_complemento,
      cliente_bairro,
      cliente_cidade,
      cliente_uf,
      cliente_pais,
      cliente_ibge,
      cliente_cnae,
      cliente_inscricao_estadual,
      cliente_inscricao_municipal,
      cliente_optante_simples_nacional,
      cliente_regime_tributario,
      cliente_website,
      cliente_instagram,
      cliente_facebook,
      cliente_linkedin,
      cliente_origem_lead,
      cliente_tags,
      cliente_observacoes,
      user_id,
      created_at,
      updated_at,
      deleted_at
    `
    )
    .order('created_at', { ascending: false })

  if (!includeDeleted) q = q.is('deleted_at', null)

  if (search) {
    const digits = normalizeDigits(search)
    const term = search.replaceAll('%', '').replaceAll('_', '')
    const ilike = `%${term}%`
    const orParts = [
      `cliente_nome_razao_social.ilike.${ilike}`,
      `cliente_nome_fantasia.ilike.${ilike}`,
      `cliente_email.ilike.${ilike}`,
      `cliente_telefone.ilike.${ilike}`,
      `cliente_documento.ilike.%${digits || term}%`
    ]
    q = q.or(orParts.join(','))
  }

  const { data, error } = await q

  if (error) {
    if (error.code === '42P01') return []
    console.error('Erro ao buscar clientes:', error)
    return []
  }

  return data as Cliente[]
}

export async function fetchClienteById(clienteId: string) {
  const id = (clienteId || '').trim()
  if (!id) return null
  const { data, error } = await (supabase as any)
    .from('crm_clientes')
    .select('cliente_id, cliente_nome_razao_social, cliente_documento, cliente_documento_formatado, deleted_at')
    .eq('cliente_id', id)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') return null
    console.error('Erro ao buscar cliente por ID:', error)
    return null
  }

  if (!data) return null
  if (data.deleted_at) return null
  return data as Pick<Cliente, 'cliente_id' | 'cliente_nome_razao_social' | 'cliente_documento' | 'cliente_documento_formatado' | 'deleted_at'>
}

export async function createCliente(payload: CreateClientePayload) {
  const { data, error } = await (supabase as any)
    .from('crm_clientes')
    .upsert({
      ...payload,
      cliente_documento: payload.cliente_documento ? normalizeDigits(payload.cliente_documento) : null,
      cliente_email: payload.cliente_email ? payload.cliente_email.trim().toLowerCase() : null,
      cliente_uf: payload.cliente_uf ? payload.cliente_uf.trim().toUpperCase() : null,
      cliente_pais: payload.cliente_pais ? payload.cliente_pais.trim().toUpperCase() : 'BR',
      deleted_at: null
    }, { onConflict: 'cliente_documento' })
    .select(
      `
      cliente_id,
      integ_id,
      cliente_nome_razao_social,
      cliente_nome_fantasia,
      cliente_documento,
      cliente_documento_formatado,
      cliente_tipo_pessoa,
      cliente_vertical,
      cliente_email,
      cliente_telefone,
      cliente_cep,
      cliente_endereco,
      cliente_numero,
      cliente_complemento,
      cliente_bairro,
      cliente_cidade,
      cliente_uf,
      cliente_pais,
      cliente_ibge,
      cliente_cnae,
      cliente_inscricao_estadual,
      cliente_inscricao_municipal,
      cliente_optante_simples_nacional,
      cliente_regime_tributario,
      cliente_website,
      cliente_instagram,
      cliente_facebook,
      cliente_linkedin,
      cliente_origem_lead,
      cliente_tags,
      cliente_observacoes,
      user_id,
      created_at,
      updated_at,
      deleted_at
    `
    )
    .single()

  if (error) throw error
  return data as Cliente
}

export async function updateCliente(clienteId: string, updates: UpdateClientePayload) {
  const { data, error } = await (supabase as any)
    .from('crm_clientes')
    .update({
      ...updates,
      cliente_documento: updates.cliente_documento ? normalizeDigits(String(updates.cliente_documento)) : updates.cliente_documento,
      cliente_email: updates.cliente_email ? updates.cliente_email.trim().toLowerCase() : updates.cliente_email,
      cliente_uf: updates.cliente_uf ? updates.cliente_uf.trim().toUpperCase() : updates.cliente_uf,
      cliente_pais: updates.cliente_pais ? updates.cliente_pais.trim().toUpperCase() : updates.cliente_pais
    })
    .eq('cliente_id', clienteId)
    .select(
      `
      cliente_id,
      integ_id,
      cliente_nome_razao_social,
      cliente_nome_fantasia,
      cliente_documento,
      cliente_documento_formatado,
      cliente_tipo_pessoa,
      cliente_vertical,
      cliente_email,
      cliente_telefone,
      cliente_cep,
      cliente_endereco,
      cliente_numero,
      cliente_complemento,
      cliente_bairro,
      cliente_cidade,
      cliente_uf,
      cliente_pais,
      cliente_ibge,
      cliente_cnae,
      cliente_inscricao_estadual,
      cliente_inscricao_municipal,
      cliente_optante_simples_nacional,
      cliente_regime_tributario,
      cliente_website,
      cliente_instagram,
      cliente_facebook,
      cliente_linkedin,
      cliente_origem_lead,
      cliente_tags,
      cliente_observacoes,
      user_id,
      created_at,
      updated_at,
      deleted_at
    `
    )
    .single()

  if (error) throw error
  return data as Cliente
}

export async function softDeleteCliente(clienteId: string) {
  const { error } = await (supabase as any)
    .from('crm_clientes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('cliente_id', clienteId)

  if (error) throw error
}
