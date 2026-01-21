import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { fetchOmieServics, OmieServic } from '@/services/omieServics'

type UseOmieServicsResult = {
  items: OmieServic[]
  setItems: Dispatch<SetStateAction<OmieServic[]>>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useOmieServics(): UseOmieServicsResult {
  const [items, setItems] = useState<OmieServic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchOmieServics()
      setItems(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar dados do OMIE'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel('omie_servics_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'omie_servics' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id_omie as string | undefined
            if (!id) return
            setItems((prev) => prev.filter((r) => r.id_omie !== id))
            return
          }

          const next = payload.new as any as OmieServic
          if (!next?.id_omie) return

          setItems((prev) => {
            const idx = prev.findIndex((r) => r.id_omie === next.id_omie)
            if (idx < 0) return [next, ...prev]
            const copy = prev.slice()
            copy[idx] = { ...copy[idx], ...next }
            return copy
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { items, setItems, loading, error, refresh }
}
