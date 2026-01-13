import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos (Dados considerados frescos)
      gcTime: 1000 * 60 * 30,   // 30 minutos (Tempo em memória/cache)
      refetchOnWindowFocus: false, // Evita refetch ao trocar de aba (opcional)
      refetchOnReconnect: false, // Evita refetch ao reconectar
      refetchOnMount: false, // Evita refetch ao montar componente se dados existirem
      retry: 1,
    },
  },
})
