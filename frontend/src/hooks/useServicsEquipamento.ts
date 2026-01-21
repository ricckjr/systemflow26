import { useState, useCallback, useEffect } from 'react'
import { ServicEquipamento } from '@/types/domain'
import { getServicsEquipamentos, updateServicEquipamentoFase, createServicEquipamento, getServicsEquipamentosByProposal, uploadEquipmentImage } from '@/services/servicsEquipamento'

export function useServicsEquipamento() {
  const [services, setServices] = useState<ServicEquipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getServicsEquipamentos()
      setServices(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const moveService = useCallback(async (serviceId: string, newFase: string) => {
    // Optimistic update
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, fase: newFase, updated_at: new Date().toISOString() } : s))
    
    try {
      await updateServicEquipamentoFase(serviceId, newFase)
    } catch (err: any) {
      setError(err.message)
      // Revert on error
      refresh()
    }
  }, [refresh])

  const addService = useCallback(async (service: Omit<ServicEquipamento, 'id' | 'id_rst' | 'created_at' | 'updated_at'>) => {
    try {
      const newService = await createServicEquipamento(service)
      setServices(prev => [newService, ...prev])
      return newService
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  const uploadImage = useCallback(async (file: File) => {
    return await uploadEquipmentImage(file)
  }, [])

  return {
    services,
    loading,
    error,
    refresh,
    moveService,
    addService,
    uploadImage
  }
}

export function useProposalServices(codProposta: string) {
  const [services, setServices] = useState<ServicEquipamento[]>([])
  const [loading, setLoading] = useState(true)
  
  const refresh = useCallback(async () => {
    if (!codProposta) return
    setLoading(true)
    try {
      const data = await getServicsEquipamentosByProposal(codProposta)
      setServices(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [codProposta])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { services, loading, refresh }
}
