import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { fetchOportunidades, fetchLigacoes, fetchPabxLigacoes, fetchMeta, updateMeta, createMeta, CRM_Meta } from '../services/crm'
import { useAuth } from '@/contexts/AuthContext'

export const CRM_KEYS = {
  all: ['crm'] as const,
  oportunidades: () => [...CRM_KEYS.all, 'oportunidades'] as const,
  ligacoes: () => [...CRM_KEYS.all, 'ligacoes'] as const,
  pabxLigacoes: () => [...CRM_KEYS.all, 'pabxLigacoes'] as const,
  meta: () => [...CRM_KEYS.all, 'meta'] as const,
}

export function useOportunidades() {
  const { systemReady } = useAuth()
  return useQuery({
    queryKey: CRM_KEYS.oportunidades(),
    queryFn: () => fetchOportunidades({ orderDesc: true }),
    enabled: systemReady,
    staleTime: 1000 * 60 * 1, // 1 min
    gcTime: 1000 * 60 * 10,   // 10 min
    refetchInterval: 1000 * 60 * 5, // Auto-refresh a cada 5 min
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff: 1s, 2s, 4s... max 10s
  })
}

export function useLigacoes() {
  const { systemReady } = useAuth()
  return useQuery({
    queryKey: CRM_KEYS.ligacoes(),
    queryFn: fetchLigacoes,
    enabled: systemReady,
    staleTime: 1000 * 60 * 1,
    refetchInterval: 1000 * 60 * 5,
  })
}

export function usePabxLigacoes() {
  const { systemReady } = useAuth()
  return useQuery({
    queryKey: CRM_KEYS.pabxLigacoes(),
    queryFn: fetchPabxLigacoes,
    enabled: systemReady,
    staleTime: 1000 * 60 * 1,
    refetchInterval: 1000 * 60 * 5,
  })
}

export function useMeta() {
  const { systemReady } = useAuth()
  return useQuery({
    queryKey: CRM_KEYS.meta(),
    queryFn: fetchMeta,
    enabled: systemReady,
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
