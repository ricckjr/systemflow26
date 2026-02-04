import { supabase } from '@/services/supabase'

const sb = supabase as any

export type FinFormaPagamento = {
  forma_id: string
  codigo: string
  descricao: string
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export type FinCondicaoPagamento = {
  condicao_id: string
  codigo: string
  descricao: string
  parcelas_dias: number[]
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export async function fetchFinFormasPagamento() {
  const { data, error } = await sb
    .from('fin_formas_pagamento')
    .select('forma_id,codigo,descricao,ativo,created_at,updated_at')
    .order('codigo', { ascending: true })
  if (error) return []
  return (data ?? []) as FinFormaPagamento[]
}

export async function createFinFormaPagamento(payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('fin_formas_pagamento')
    .insert({
      codigo: payload.codigo,
      descricao: payload.descricao || payload.codigo,
      ativo: true
    })
    .select('forma_id,codigo,descricao,ativo,created_at,updated_at')
    .single()
  if (error) throw error
  return data as FinFormaPagamento
}

export async function updateFinFormaPagamento(id: string, payload: { codigo: string; descricao: string | null }) {
  const { data, error } = await sb
    .from('fin_formas_pagamento')
    .update({
      codigo: payload.codigo,
      descricao: payload.descricao || payload.codigo,
      updated_at: new Date().toISOString()
    })
    .eq('forma_id', id)
    .select('forma_id,codigo,descricao,ativo,created_at,updated_at')
    .single()
  if (error) throw error
  return data as FinFormaPagamento
}

export async function deleteFinFormaPagamento(id: string) {
  const { error } = await sb.from('fin_formas_pagamento').delete().eq('forma_id', id)
  if (error) throw error
}

export async function fetchFinCondicoesPagamento() {
  const { data, error } = await sb
    .from('fin_condicoes_pagamento')
    .select('condicao_id,codigo,descricao,parcelas_dias,ativo,created_at,updated_at')
    .order('codigo', { ascending: true })
  if (error) return []
  return (data ?? []) as FinCondicaoPagamento[]
}

export async function createFinCondicaoPagamento(payload: { codigo: string; descricao: string | null; parcelas_dias: number[] }) {
  const { data, error } = await sb
    .from('fin_condicoes_pagamento')
    .insert({
      codigo: payload.codigo,
      descricao: payload.descricao || payload.codigo,
      parcelas_dias: payload.parcelas_dias,
      ativo: true
    })
    .select('condicao_id,codigo,descricao,parcelas_dias,ativo,created_at,updated_at')
    .single()
  if (error) throw error
  return data as FinCondicaoPagamento
}

export async function updateFinCondicaoPagamento(
  id: string,
  payload: { codigo: string; descricao: string | null; parcelas_dias: number[] }
) {
  const { data, error } = await sb
    .from('fin_condicoes_pagamento')
    .update({
      codigo: payload.codigo,
      descricao: payload.descricao || payload.codigo,
      parcelas_dias: payload.parcelas_dias,
      updated_at: new Date().toISOString()
    })
    .eq('condicao_id', id)
    .select('condicao_id,codigo,descricao,parcelas_dias,ativo,created_at,updated_at')
    .single()
  if (error) throw error
  return data as FinCondicaoPagamento
}

export async function deleteFinCondicaoPagamento(id: string) {
  const { error } = await sb.from('fin_condicoes_pagamento').delete().eq('condicao_id', id)
  if (error) throw error
}

