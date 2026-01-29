import { useState, useCallback, useEffect } from 'react'
import { ServicEquipamento } from '@/types/domain'
import { getServicsEquipamentos, updateServicEquipamentoFase, createServicEquipamento, getServicsEquipamentosByProposal, uploadEquipmentImage, updateServicEquipamentoAnaliseVisual, updateServicEquipamentoTestesRealizados, updateServicEquipamentoServicosAFazer, updateServicEquipamentoImagens, updateServicEquipamentoCertificadoCalibracao } from '@/services/servicsEquipamento'

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

  const moveService = useCallback(async (serviceId: string, newFase: string, responsavel?: string, servicosRealizados?: string, observacoes?: string) => {
    // Optimistic update
    setServices(prev => prev.map(s => s.id === serviceId ? { 
      ...s, 
      fase: newFase, 
      responsavel: responsavel !== undefined ? responsavel : s.responsavel,
      updated_at: new Date().toISOString() 
    } : s))
    
    try {
      await updateServicEquipamentoFase(serviceId, newFase, responsavel, servicosRealizados, observacoes)
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

  const updateAnaliseVisual = useCallback(async (serviceId: string, analiseVisual: string | null) => {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, observacoes_equipamento: analiseVisual, updated_at: new Date().toISOString() } : s))
    try {
      await updateServicEquipamentoAnaliseVisual(serviceId, analiseVisual)
    } catch (err: any) {
      setError(err.message)
      refresh()
    }
  }, [refresh])

  const updateTestesRealizados = useCallback(async (serviceId: string, testesRealizados: string | null) => {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, testes_realizados: testesRealizados, updated_at: new Date().toISOString() } : s))
    try {
      await updateServicEquipamentoTestesRealizados(serviceId, testesRealizados)
    } catch (err: any) {
      setError(err.message)
      refresh()
    }
  }, [refresh])

  const updateServicosAFazer = useCallback(async (serviceId: string, servicosAFazer: string | null) => {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, servicos_a_fazer: servicosAFazer, updated_at: new Date().toISOString() } : s))
    try {
      await updateServicEquipamentoServicosAFazer(serviceId, servicosAFazer)
    } catch (err: any) {
      setError(err.message)
      refresh()
    }
  }, [refresh])

  const updateImagens = useCallback(async (serviceId: string, imagens: string[] | null) => {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, imagens, updated_at: new Date().toISOString() } : s))
    try {
      await updateServicEquipamentoImagens(serviceId, imagens)
    } catch (err: any) {
      setError(err.message)
      refresh()
    }
  }, [refresh])

  const updateCertificadoCalibracao = useCallback(async (serviceId: string, numeroCertificado: string | null, dataCalibracao: string | null) => {
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, numero_certificado: numeroCertificado, data_calibracao: dataCalibracao, updated_at: new Date().toISOString() } : s))
    try {
      await updateServicEquipamentoCertificadoCalibracao(serviceId, numeroCertificado, dataCalibracao)
    } catch (err: any) {
      setError(err.message)
      refresh()
    }
  }, [refresh])

  return {
    services,
    loading,
    error,
    refresh,
    moveService,
    addService,
    uploadImage,
    updateAnaliseVisual,
    updateTestesRealizados,
    updateServicosAFazer,
    updateImagens,
    updateCertificadoCalibracao
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
