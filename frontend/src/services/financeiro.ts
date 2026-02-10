import { supabase } from '@/services/supabase'

const sb = supabase as any

export type FinFormaPagamento = {
  forma_id: string
  descricao: string
  codigo?: string | null
  observacao?: string | null
  observacoes?: string | null
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export type FinCondicaoPagamento = {
  condicao_id: string
  descricao: string
  codigo?: string | null
  observacao?: string | null
  parcelas_dias?: number[]
  ativo: boolean
  created_at?: string
  updated_at?: string
}

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

const toUserFacingError = (error: any, fallback: string) => {
  if (error instanceof Error) return error
  const msg = String(error?.message || '').trim()
  const details = String(error?.details || '').trim()
  const hint = String(error?.hint || '').trim()
  const code = String(error?.code || '').trim()

  const combined = `${msg}\n${details}\n${hint}`.trim()
  const lc = combined.toLowerCase()

  if (lc.includes('row level security') || lc.includes('violates row-level security policy')) {
    return new Error('Sem permissão para realizar esta ação no Financeiro (exige FINANCEIRO:CONTROL).')
  }

  const best = msg || details || hint
  const withCode = best ? (code ? `${best} (${code})` : best) : fallback
  return new Error(withCode)
}

const createRandomCode = (prefix: string) => {
  const anyCrypto = (globalThis as any)?.crypto
  const uuid = typeof anyCrypto?.randomUUID === 'function' ? String(anyCrypto.randomUUID()) : `${Date.now()}-${Math.random()}`
  return `${prefix}_${uuid.replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

export async function fetchFinFormasPagamento() {
  const wide = 'forma_id,codigo,descricao,observacao,observacoes,ativo,created_at,updated_at'
  const minimal = 'forma_id,descricao,observacao,observacoes,ativo,created_at,updated_at'

  const r1 = await sb.from('fin_formas_pagamento').select(wide).order('descricao', { ascending: true })
  if (!r1.error) {
    return (r1.data ?? []).map((row: any) => ({
      ...row,
      observacao: row?.observacao ?? row?.observacoes ?? null
    })) as FinFormaPagamento[]
  }

  if (!isMissingColumn(r1.error)) return []

  const r2 = await sb.from('fin_formas_pagamento').select(minimal).order('descricao', { ascending: true })
  if (r2.error) return []
  return (r2.data ?? []).map((row: any) => ({
    ...row,
    observacao: row?.observacao ?? row?.observacoes ?? null
  })) as FinFormaPagamento[]
}

export async function createFinFormaPagamento(payload: { descricao: string; observacao?: string | null }) {
  let insertPayload: any = {
    codigo: createRandomCode('FP'),
    descricao: payload.descricao,
    observacao: payload.observacao || null,
    observacoes: payload.observacao || null,
    ativo: true
  }

  for (let i = 0; i < 6; i++) {
    const r = await sb
      .from('fin_formas_pagamento')
      .insert(insertPayload)
      .select()
      .single()
    if (!r.error) {
      const row: any = r.data
      return { ...(row || {}), observacao: row?.observacao ?? row?.observacoes ?? null } as FinFormaPagamento
    }
    if (isMissingColumn(r.error)) {
      const missing = extractMissingColumnName(r.error)
      if (missing && Object.prototype.hasOwnProperty.call(insertPayload, missing)) {
        delete insertPayload[missing]
        continue
      }
    }
    throw toUserFacingError(r.error, 'Falha ao criar forma de pagamento.')
  }
  throw new Error('Falha ao criar forma de pagamento.')
}

export async function updateFinFormaPagamento(id: string, payload: { descricao: string; observacao?: string | null }) {
  let updates: any = {
    descricao: payload.descricao,
    observacao: payload.observacao || null,
    observacoes: payload.observacao || null,
    updated_at: new Date().toISOString()
  }

  for (let i = 0; i < 6; i++) {
    const r = await sb
      .from('fin_formas_pagamento')
      .update(updates)
      .eq('forma_id', id)
      .select()
      .single()
    if (!r.error) {
      const row: any = r.data
      return { ...(row || {}), observacao: row?.observacao ?? row?.observacoes ?? null } as FinFormaPagamento
    }
    if (isMissingColumn(r.error)) {
      const missing = extractMissingColumnName(r.error)
      if (missing && Object.prototype.hasOwnProperty.call(updates, missing)) {
        delete updates[missing]
        continue
      }
    }
    throw toUserFacingError(r.error, 'Falha ao atualizar forma de pagamento.')
  }
  throw new Error('Falha ao atualizar forma de pagamento.')
}

export async function deleteFinFormaPagamento(id: string) {
  const { error } = await sb.from('fin_formas_pagamento').delete().eq('forma_id', id)
  if (error) throw toUserFacingError(error, 'Falha ao excluir forma de pagamento.')
}

export async function fetchFinCondicoesPagamento() {
  const wide = 'condicao_id,codigo,descricao,observacao,parcelas_dias,ativo,created_at,updated_at'
  const minimal = 'condicao_id,descricao,observacao,ativo,created_at,updated_at'

  const r1 = await sb.from('fin_condicoes_pagamento').select(wide).order('descricao', { ascending: true })
  if (!r1.error) return (r1.data ?? []) as FinCondicaoPagamento[]
  if (!isMissingColumn(r1.error)) return []

  const r2 = await sb.from('fin_condicoes_pagamento').select(minimal).order('descricao', { ascending: true })
  if (r2.error) return []
  return (r2.data ?? []) as FinCondicaoPagamento[]
}

export async function createFinCondicaoPagamento(payload: { descricao: string; observacao?: string | null; parcelas_dias?: number[] }) {
  let insertPayload: any = {
    codigo: createRandomCode('CP'),
    descricao: payload.descricao,
    observacao: payload.observacao || null,
    parcelas_dias: payload.parcelas_dias && payload.parcelas_dias.length ? payload.parcelas_dias : [0],
    ativo: true
  }

  for (let i = 0; i < 6; i++) {
    const r = await sb
      .from('fin_condicoes_pagamento')
      .insert(insertPayload)
      .select()
      .single()
    if (!r.error) return r.data as FinCondicaoPagamento
    if (isMissingColumn(r.error)) {
      const missing = extractMissingColumnName(r.error)
      if (missing && Object.prototype.hasOwnProperty.call(insertPayload, missing)) {
        delete insertPayload[missing]
        continue
      }
    }
    throw toUserFacingError(r.error, 'Falha ao criar condição de pagamento.')
  }
  throw new Error('Falha ao criar condição de pagamento.')
}

export async function updateFinCondicaoPagamento(
  id: string,
  payload: { descricao: string; observacao?: string | null; parcelas_dias?: number[] }
) {
  const updates: any = {
    descricao: payload.descricao,
    observacao: payload.observacao || null,
    updated_at: new Date().toISOString()
  }
  if (payload.parcelas_dias) updates.parcelas_dias = payload.parcelas_dias

  for (let i = 0; i < 6; i++) {
    const r = await sb
      .from('fin_condicoes_pagamento')
      .update(updates)
      .eq('condicao_id', id)
      .select()
      .single()
    if (!r.error) return r.data as FinCondicaoPagamento
    if (isMissingColumn(r.error)) {
      const missing = extractMissingColumnName(r.error)
      if (missing && Object.prototype.hasOwnProperty.call(updates, missing)) {
        delete updates[missing]
        continue
      }
    }
    throw toUserFacingError(r.error, 'Falha ao atualizar condição de pagamento.')
  }
  throw new Error('Falha ao atualizar condição de pagamento.')
}

export async function deleteFinCondicaoPagamento(id: string) {
  const { error } = await sb.from('fin_condicoes_pagamento').delete().eq('condicao_id', id)
  if (error) throw toUserFacingError(error, 'Falha ao excluir condição de pagamento.')
}

export type FinEmpresaCorrespondente = {
  empresa_id: string
  codigo: string
  razao_social?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  logo_path?: string | null
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export async function fetchFinEmpresasCorrespondentes() {
  const cols =
    'empresa_id,codigo,razao_social,nome_fantasia,cnpj,inscricao_estadual,inscricao_municipal,endereco,bairro,cidade,uf,cep,telefone,logo_path,ativo,created_at,updated_at'
  const r = await sb.from('fin_empresas_correspondentes').select(cols).order('nome_fantasia', { ascending: true })
  if (r.error) return []
  return (r.data ?? []) as FinEmpresaCorrespondente[]
}

export async function createFinEmpresaCorrespondente(payload: {
  razao_social?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  logo_path?: string | null
  ativo?: boolean
}) {
  const insertPayload: any = {
    razao_social: payload.razao_social ?? null,
    nome_fantasia: payload.nome_fantasia ?? null,
    cnpj: payload.cnpj ?? null,
    inscricao_estadual: payload.inscricao_estadual ?? null,
    inscricao_municipal: payload.inscricao_municipal ?? null,
    endereco: payload.endereco ?? null,
    bairro: payload.bairro ?? null,
    cidade: payload.cidade ?? null,
    uf: payload.uf ?? null,
    cep: payload.cep ?? null,
    telefone: payload.telefone ?? null,
    logo_path: payload.logo_path ?? null,
    ativo: payload.ativo ?? true
  }

  const r = await sb
    .from('fin_empresas_correspondentes')
    .insert(insertPayload)
    .select()
    .single()
  if (r.error) throw toUserFacingError(r.error, 'Falha ao criar empresa correspondente.')
  return r.data as FinEmpresaCorrespondente
}

export async function updateFinEmpresaCorrespondente(
  empresaId: string,
  payload: {
    razao_social?: string | null
    nome_fantasia?: string | null
    cnpj?: string | null
    inscricao_estadual?: string | null
    inscricao_municipal?: string | null
    endereco?: string | null
    bairro?: string | null
    cidade?: string | null
    uf?: string | null
    cep?: string | null
    telefone?: string | null
    logo_path?: string | null
    ativo?: boolean
  }
) {
  const updates: any = {
    updated_at: new Date().toISOString()
  }
  if (payload.razao_social !== undefined) updates.razao_social = payload.razao_social
  if (payload.nome_fantasia !== undefined) updates.nome_fantasia = payload.nome_fantasia
  if (payload.cnpj !== undefined) updates.cnpj = payload.cnpj
  if (payload.inscricao_estadual !== undefined) updates.inscricao_estadual = payload.inscricao_estadual
  if (payload.inscricao_municipal !== undefined) updates.inscricao_municipal = payload.inscricao_municipal
  if (payload.endereco !== undefined) updates.endereco = payload.endereco
  if (payload.bairro !== undefined) updates.bairro = payload.bairro
  if (payload.cidade !== undefined) updates.cidade = payload.cidade
  if (payload.uf !== undefined) updates.uf = payload.uf
  if (payload.cep !== undefined) updates.cep = payload.cep
  if (payload.telefone !== undefined) updates.telefone = payload.telefone
  if (payload.logo_path !== undefined) updates.logo_path = payload.logo_path
  if (payload.ativo !== undefined) updates.ativo = payload.ativo

  const r = await sb
    .from('fin_empresas_correspondentes')
    .update(updates)
    .eq('empresa_id', empresaId)
    .select()
    .single()
  if (r.error) throw toUserFacingError(r.error, 'Falha ao atualizar empresa correspondente.')
  return r.data as FinEmpresaCorrespondente
}

export async function deleteFinEmpresaCorrespondente(empresaId: string) {
  const { error } = await sb.from('fin_empresas_correspondentes').delete().eq('empresa_id', empresaId)
  if (error) throw toUserFacingError(error, 'Falha ao excluir empresa correspondente.')
}

export const getFinEmpresaCorrespondenteLogoUrl = (path: string | null | undefined) => {
  const p = String(path || '').trim()
  if (!p) return ''
  return supabase.storage.from('fin-empresas-correspondentes-logos').getPublicUrl(p).data.publicUrl
}

export async function uploadFinEmpresaCorrespondenteLogo(args: { file: File; empresaId: string; userId: string }) {
  const { file, empresaId, userId } = args
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Imagem inválida. Use JPG, PNG ou WEBP.')
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Imagem muito grande. Máximo 3MB.')
  }

  const parts = String(file.name || '').split('.')
  const ext = (parts.length > 1 ? parts[parts.length - 1] : 'png').toLowerCase()
  const safeExt = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' ? ext : 'png'
  const path = `fin-empresas-correspondentes-logos/${userId}/${empresaId}-${Date.now()}.${safeExt}`

  const { error: upError } = await supabase.storage.from('fin-empresas-correspondentes-logos').upload(path, file, { upsert: true })
  if (upError) throw upError

  const { data } = supabase.storage.from('fin-empresas-correspondentes-logos').getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}
