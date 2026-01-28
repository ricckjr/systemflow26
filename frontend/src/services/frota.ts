import { supabase } from '@/services/supabase'

export type FrotaVeiculoStatus = 'ativo' | 'inativo' | 'em_manutencao'

export type FrotaVeiculo = {
  id: string
  placa: string
  modelo: string | null
  marca: string | null
  ano: number | null
  tipo: string | null
  status: FrotaVeiculoStatus
  imagem_url: string | null
  observacoes: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export function formatFrotaVeiculoStatus(status: FrotaVeiculoStatus) {
  if (status === 'ativo') return 'Ativo'
  if (status === 'inativo') return 'Inativo'
  return 'Em Manutenção'
}

export async function fetchFrotaVeiculos() {
  const { data, error } = await supabase
    .from('frota_veiculos' as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as FrotaVeiculo[]) || []
}

export type FrotaDiarioBordoRow = {
  id: string
  data_utilizacao: string
  km_inicial: number
  km_final: number
  destino: string
  observacoes: string | null
  corrige_id: string | null
  motivo_correcao: string | null
  created_at: string
  frota_veiculos?: {
    id: string
    placa: string
    marca: string | null
    modelo: string | null
  } | null
  profiles?: {
    id: string
    nome: string
  } | null
}

export type FetchFrotaDiarioParams = {
  veiculoId?: string
  responsavelId?: string
  inicio?: string
  fim?: string
  limit?: number
}

export async function fetchFrotaDiarioBordo(params: FetchFrotaDiarioParams = {}) {
  const { veiculoId, responsavelId, inicio, fim, limit = 200 } = params

  let query = supabase
    .from('frota_diario_bordo' as any)
    .select(
      [
        'id',
        'data_utilizacao',
        'km_inicial',
        'km_final',
        'destino',
        'observacoes',
        'corrige_id',
        'motivo_correcao',
        'created_at',
        'frota_veiculos!frota_diario_bordo_veiculo_id_fkey(id,placa,marca,modelo)',
        'profiles!frota_diario_bordo_responsavel_id_fkey(id,nome)',
      ].join(',')
    )
    .order('data_utilizacao', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  if (responsavelId) query = query.eq('responsavel_id', responsavelId)
  if (inicio) query = query.gte('data_utilizacao', inicio)
  if (fim) query = query.lte('data_utilizacao', fim)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as FrotaDiarioBordoRow[]) || []
}
