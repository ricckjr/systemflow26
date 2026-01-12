import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOportunidades, fetchLigacoes } from '../services/crm'

export const CRM_KEYS = {
  all: ['crm'] as const,
  oportunidades: () => [...CRM_KEYS.all, 'oportunidades'] as const,
  ligacoes: () => [...CRM_KEYS.all, 'ligacoes'] as const,
}

export function useOportunidades() {
  return useQuery({
    queryKey: CRM_KEYS.oportunidades(),
    queryFn: () => fetchOportunidades({ orderDesc: true }),
    staleTime: 1000 * 60 * 5, // 5 min (Mantém fresco por 5 min)
    gcTime: 1000 * 60 * 30,   // 30 min (Mantém na memória se não usado)
    refetchInterval: 1000 * 60 * 5, // Auto-refresh a cada 5 min
  })
}

export function useLigacoes() {
  return useQuery({
    queryKey: CRM_KEYS.ligacoes(),
    queryFn: fetchLigacoes,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  })
}

export function useInvalidateCRM() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: CRM_KEYS.all })
}
