import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 1, // 1 minuto (Reduzido de 5min para garantir frescor)
      gcTime: 1000 * 60 * 10,   // 10 minutos (Reduzido de 30min para liberar memória)
      refetchOnWindowFocus: true, // Reativado para atualizar dados ao voltar para a aba
      refetchOnReconnect: true,
      refetchOnMount: true, // Reativado para garantir dados frescos na navegação
      retry: 1,
    },
  },
})
