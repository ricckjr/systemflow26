import { useQuery } from '@tanstack/react-query'
import { fetchFrotaDiarioBordo, fetchFrotaVeiculos, FetchFrotaDiarioParams } from '@/services/frota'

export const FROTA_KEYS = {
  all: ['frota'] as const,
  veiculos: () => [...FROTA_KEYS.all, 'veiculos'] as const,
  diarioBordo: (params: FetchFrotaDiarioParams) =>
    [
      ...FROTA_KEYS.all,
      'diario_bordo',
      params.veiculoId ?? null,
      params.responsavelId ?? null,
      params.inicio ?? null,
      params.fim ?? null,
    ] as const,
}

export function useFrotaVeiculos() {
  return useQuery({
    queryKey: FROTA_KEYS.veiculos(),
    queryFn: fetchFrotaVeiculos,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  })
}

export function useFrotaDiarioBordo(params: FetchFrotaDiarioParams) {
  return useQuery({
    queryKey: FROTA_KEYS.diarioBordo(params),
    queryFn: () => fetchFrotaDiarioBordo(params),
    staleTime: 1000 * 30,
    retry: 2,
  })
}
