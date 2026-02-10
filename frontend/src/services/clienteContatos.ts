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

const isMissingColumn = (error: any) => {
  const code = String(error?.code || '')
  const msg = String(error?.message || '')
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (msg.includes('Could not find') && msg.toLowerCase().includes('column')) ||
    (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('schema cache'))
  )
}

const extractMissingColumnName = (error: any) => {
  const msg = String(error?.message || '')
  const m1 = msg.match(/Could not find the '([^']+)' column/i)
  if (m1?.[1]) return m1[1]
  const m2 = msg.match(/column "([^"]+)"/i)
  if (m2?.[1]) return m2[1]
  const m3 = msg.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i)
  if (m3?.[1]) {
    const full = m3[1]
    const parts = full.split('.').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : full
  }
  return null
}

export async function fetchClienteContatos(clienteId: string) {
  const id = String(clienteId || '').trim()
  if (!id) return []
  const sb = supabase as any
  let cols = [
    'contato_id',
    'integ_id',
    'cliente_id',
    'contato_nome',
    'contato_cargo',
    'contato_telefone01',
    'contato_telefone02',
    'contato_email',
    'user_id',
    'contato_obs',
    'data_inclusao',
    'data_atualizacao',
    'deleted_at'
  ]
  let hasDeletedAt = true
  let orderCol: string | null = 'data_inclusao'

  for (let i = 0; i < 20; i++) {
    let q = sb.from('crm_contatos').select(cols.join(', ')).eq('cliente_id', id)
    if (hasDeletedAt) q = q.is('deleted_at', null)
    if (orderCol) q = q.order(orderCol, { ascending: false })
    const { data, error } = await q

    if (!error) return (data ?? []) as ClienteContato[]
    if (error.code === '42P01') return []

    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (missing === 'deleted_at') {
          hasDeletedAt = false
          cols = cols.filter((c) => c !== 'deleted_at')
          continue
        }
        if (orderCol && missing === orderCol) {
          orderCol = null
          continue
        }
        const before = cols.length
        cols = cols.filter((c) => c !== missing)
        if (cols.length !== before) continue
      }
    }

    console.error('Erro ao buscar contatos do cliente:', error)
    return []
  }

  return []
}

export async function fetchContatoById(contatoId: string) {
  const id = (contatoId || '').trim()
  if (!id) return null
  const sb = supabase as any
  let cols = [
    'contato_id',
    'integ_id',
    'cliente_id',
    'contato_nome',
    'contato_cargo',
    'contato_telefone01',
    'contato_telefone02',
    'contato_email',
    'user_id',
    'contato_obs',
    'data_inclusao',
    'data_atualizacao',
    'deleted_at'
  ]
  let hasDeletedAt = true

  for (let i = 0; i < 20; i++) {
    const q = sb.from('crm_contatos').select(cols.join(', ')).eq('contato_id', id).maybeSingle()
    const { data, error } = await q
    if (!error) {
      if (!data) return null
      if (hasDeletedAt && (data as any).deleted_at) return null
      return data as ClienteContato
    }
    if (error.code === '42P01') return null
    if (isMissingColumn(error)) {
      const missing = extractMissingColumnName(error)
      if (missing) {
        if (missing === 'deleted_at') {
          hasDeletedAt = false
          cols = cols.filter((c) => c !== 'deleted_at')
          continue
        }
        const before = cols.length
        cols = cols.filter((c) => c !== missing)
        if (cols.length !== before) continue
      }
    }
    console.error('Erro ao buscar contato por ID:', error)
    return null
  }

  return null
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
