import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { fetchOportunidades, fetchLigacoes, fetchPabxLigacoes, fetchVendedoresPerformance, fetchMeta, updateMeta, createMeta, CRM_Meta } from '../services/crm'

export const CRM_KEYS = {
  all: ['crm'] as const,
  oportunidades: () => [...CRM_KEYS.all, 'oportunidades'] as const,
  ligacoes: () => [...CRM_KEYS.all, 'ligacoes'] as const,
  pabxLigacoes: () => [...CRM_KEYS.all, 'pabxLigacoes'] as const,
  vendedoresPerformance: (idData?: string) => [...CRM_KEYS.all, 'vendedoresPerformance', idData] as const,
  meta: () => [...CRM_KEYS.all, 'meta'] as const,
}

export function useOportunidades() {
  return useQuery({
    queryKey: CRM_KEYS.oportunidades(),
    queryFn: () => fetchOportunidades({ orderDesc: true }),
    staleTime: 1000 * 60 * 5, // 5 min (Mantém fresco por 5 min)
    gcTime: 1000 * 60 * 30,   // 30 min (Mantém na memória se não usado)
    refetchInterval: 1000 * 60 * 5, // Auto-refresh a cada 5 min
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff: 1s, 2s, 4s... max 10s
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

export function usePabxLigacoes() {
  return useQuery({
    queryKey: CRM_KEYS.pabxLigacoes(),
    queryFn: fetchPabxLigacoes,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  })
}

export function useVendedoresPerformance(idData?: string) {
  return useQuery({
    queryKey: CRM_KEYS.vendedoresPerformance(idData),
    queryFn: () => fetchVendedoresPerformance({ idData }),
    enabled: !!idData,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: CRM_KEYS.meta(),
    queryFn: fetchMeta,
    staleTime: 1000 * 60 * 30, // 30 min (Metas mudam pouco)
  })
}

export function useUpdateMeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id?: number; updates: Partial<CRM_Meta> }) => {
      if (id) {
        return updateMeta(id, updates)
      } else {
        // Create with defaults + updates
        return createMeta({
          meta_valor_financeiro: updates.meta_valor_financeiro || 0,
          supermeta_valor_financeiro: updates.supermeta_valor_financeiro || 0,
          meta_novas_oportunidades: updates.meta_novas_oportunidades || 0,
          meta_ligacoes: updates.meta_ligacoes || 0,
          tempo_ligacoes: updates.tempo_ligacoes || null,
          meta_geral: updates.meta_geral || null
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CRM_KEYS.meta() })
    },
  })
}

export function useInvalidateCRM() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: CRM_KEYS.all })
}
