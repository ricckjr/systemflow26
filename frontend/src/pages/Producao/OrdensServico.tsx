import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Tag, User, Calendar, MapPin, Building2, Layers, AlertCircle, Wrench, Upload, X, Maximize2, ArrowRight, History, Clock, AlertTriangle, CheckCircle2, Hourglass, Timer, Monitor, Pencil, ExternalLink, ZoomIn, Trash2, FileText } from 'lucide-react'
import { useServicsEquipamento } from '@/hooks/useServicsEquipamento'
import { ServiceKanbanBoard } from '@/components/producao/ServiceKanbanBoard'
import { DropResult } from '@hello-pangea/dnd'
import { Modal } from '@/components/ui/Modal'
import { ServicEquipamento } from '@/types/domain'
import { ETAPAS_SERVICOS, getServicHistorico } from '@/services/servicsEquipamento'
import { getOsPhaseConfig, normalizeOsPhase } from '@/config/ordemServicoKanbanConfig'
import { useUsuarios } from '../../hooks/useUsuarios'
import { formatDuration, getStatusDurationColor } from '@/utils/time'
import { useTvMode } from '@/hooks/useTvMode'

const OrdensServico: React.FC = () => {
  const { isTvMode, toggleTvMode } = useTvMode()
  const { services, loading, refresh, moveService, error, uploadImage, updateAnaliseVisual, updateTestesRealizados, updateServicosAFazer, updateImagens, updateCertificadoCalibracao } = useServicsEquipamento()
  const { usuarios } = useUsuarios()
  const [selectedService, setSelectedService] = useState<ServicEquipamento | null>(null)
  const [analiseVisual, setAnaliseVisual] = useState('')
  const [testesRealizados, setTestesRealizados] = useState('')
  const [servicosAFazer, setServicosAFazer] = useState('')
  const [numeroCertificado, setNumeroCertificado] = useState('')
  const [dataCalibracao, setDataCalibracao] = useState('')
  const [savingCampos, setSavingCampos] = useState(false)
  const [uploadingImagens, setUploadingImagens] = useState(false)
  const [expandedField, setExpandedField] = useState<'analise' | 'testes' | 'servicos' | null>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [showHistorico, setShowHistorico] = useState(false)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [galleryEditMode, setGalleryEditMode] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [confirmRemoveImageUrl, setConfirmRemoveImageUrl] = useState<string | null>(null)
  const [nextFase, setNextFase] = useState<string>('')
  const [nextResponsavel, setNextResponsavel] = useState<string>('')
  const [nextDescricao, setNextDescricao] = useState<string>('')
  const [showFaseModal, setShowFaseModal] = useState(false)
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: React.ReactNode; type: 'warning' | 'error' | 'success' }>({ isOpen: false, title: '', message: '', type: 'warning' })

  const vendedorUser = useMemo(() => {
    if (!selectedService?.vendedor) return null
    return usuarios.find(u => u.nome === selectedService.vendedor)
  }, [selectedService, usuarios])

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result
    if (!destination) return
    if (destination.droppableId === result.source.droppableId && destination.index === result.source.index) return

    moveService(draggableId, destination.droppableId)
  }

  const daysInProduction = (date: string) => {
    return Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  useEffect(() => {
    if (!selectedService) return
    setAnaliseVisual(selectedService.observacoes_equipamento || '')
    setTestesRealizados(selectedService.testes_realizados || '')
    setServicosAFazer(selectedService.servicos_a_fazer || '')
    setNumeroCertificado(selectedService.numero_certificado || '')
    setDataCalibracao(selectedService.data_calibracao ? new Date(selectedService.data_calibracao).toISOString().split('T')[0] : '')
    setGalleryEditMode(false)
    setPreviewImageUrl(null)
    setConfirmRemoveImageUrl(null)
    
    // Carregar histórico
    setLoadingHistorico(true)
    getServicHistorico(selectedService.id)
      .then(setHistorico)
      .catch(console.error)
      .finally(() => setLoadingHistorico(false))
  }, [selectedService?.id])

  const handleCloseModal = () => {
    setSelectedService(null)
    setAnaliseVisual('')
    setTestesRealizados('')
    setServicosAFazer('')
    setNumeroCertificado('')
    setDataCalibracao('')
    setSavingCampos(false)
    setUploadingImagens(false)
    setExpandedField(null)
    setHistorico([])
    setShowHistorico(false)
    setShowFaseModal(false)
    setGalleryEditMode(false)
    setPreviewImageUrl(null)
    setConfirmRemoveImageUrl(null)
  }

  const handleOpenFaseModal = () => {
      setNextFase(normalizeOsPhase(selectedService?.fase || ''))
      setNextResponsavel(selectedService?.responsavel || '')
      setNextDescricao('')
      setShowFaseModal(true)
  }

  const handleSaveFase = async () => {
      if (!selectedService || !nextFase) return
      
      // --- Validações de Regras de Negócio Obrigatórias ---

      // Regra 1: De ANALISE só pode ir para AGUARDANDO CLIENTE
      if (selectedService.fase === 'ANALISE' && nextFase !== 'AGUARDANDO CLIENTE') {
          const analiseLabel = getOsPhaseConfig('ANALISE').label
          const aguardandoLabel = getOsPhaseConfig('AGUARDANDO CLIENTE').label
          
          setAlertModal({
            isOpen: true,
            title: 'Bloqueio de Processo',
            type: 'warning',
            message: (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-[var(--text-soft)] leading-relaxed">
                        O equipamento está na fase <strong className="text-[var(--text-main)]">{analiseLabel}</strong>.
                    </p>
                    <p className="text-sm text-[var(--text-soft)] leading-relaxed">
                        Por regras de segurança e qualidade, ele só pode ser movido para:
                    </p>
                    <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] flex items-center gap-3 shadow-sm">
                        <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                            <ArrowRight size={18} />
                        </div>
                        <span className="font-bold text-[var(--text-main)] text-base">{aguardandoLabel}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                        Por favor, selecione a fase correta no modal para prosseguir.
                    </p>
                </div>
            )
          })
          return
      }

      // Regra 2: De AGUARDANDO CLIENTE só pode sair se Etapa Omie estiver APROVADO
      if (selectedService.fase === 'AGUARDANDO CLIENTE' && selectedService.fase !== nextFase) {
          const aguardandoLabel = getOsPhaseConfig('AGUARDANDO CLIENTE').label
          const etapaOmie = (selectedService.etapa_omie || '').toUpperCase()
          // Verifica se contém termos de aprovação
          const isAprovado = etapaOmie.includes('APROVADO') || 
                             etapaOmie.includes('CONCLUÍDO') || 
                             etapaOmie.includes('FATURADO') ||
                             etapaOmie.includes('GANHO')

          if (!isAprovado) {
               setAlertModal({
                isOpen: true,
                title: 'Aguardando Aprovação',
                type: 'warning',
                message: (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-[var(--text-soft)] leading-relaxed">
                            Para mover desta etapa (<strong className="text-[var(--text-main)]">{aguardandoLabel}</strong>), a proposta comercial precisa estar aprovada no sistema financeiro (Omie).
                        </p>
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Status Atual no Omie</span>
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold font-mono text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {selectedService.etapa_omie || 'NÃO INFORMADO'}
                            </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                            Verifique a situação comercial antes de prosseguir com o serviço.
                        </p>
                    </div>
                )
               })
               return
          }
      }

      try {
          if (!nextDescricao.trim()) {
            setAlertModal({
                isOpen: true,
                title: 'Campo Obrigatório',
                type: 'error',
                message: 'Por favor, descreva o motivo da movimentação no campo "Descrição".'
            })
            return
          }
          await moveService(selectedService.id, nextFase, nextResponsavel, nextDescricao)
          setSelectedService(prev => prev ? { 
              ...prev, 
              fase: nextFase, 
              responsavel: nextResponsavel,
              updated_at: new Date().toISOString()
          } : prev)
          setShowFaseModal(false)
          
          // Recarregar histórico
          setLoadingHistorico(true)
          getServicHistorico(selectedService.id)
            .then(setHistorico)
            .catch(console.error)
            .finally(() => setLoadingHistorico(false))
      } catch (error) {
          console.error('Erro ao salvar fase:', error)
          setAlertModal({
              isOpen: true,
              title: 'Erro ao Mover',
              type: 'error',
              message: String(error)
          })
      }
  }

  const camposDirty = useMemo(() => {
    if (!selectedService) return false
    return (
      (analiseVisual || '') !== (selectedService.observacoes_equipamento || '') ||
      (testesRealizados || '') !== (selectedService.testes_realizados || '') ||
      (servicosAFazer || '') !== (selectedService.servicos_a_fazer || '') ||
      (numeroCertificado || '') !== (selectedService.numero_certificado || '') ||
      (dataCalibracao || '') !== (selectedService.data_calibracao ? new Date(selectedService.data_calibracao).toISOString().split('T')[0] : '')
    )
  }, [analiseVisual, servicosAFazer, selectedService, testesRealizados, numeroCertificado, dataCalibracao])

  const handleSalvarCampos = async () => {
    if (!selectedService) return
    setSavingCampos(true)
    try {
      const analise = analiseVisual.trim()
      const testes = testesRealizados.trim()
      const servicos = servicosAFazer.trim()
      const cert = numeroCertificado.trim()
      const dataCalib = dataCalibracao

      if ((analise || '') !== (selectedService.observacoes_equipamento || '')) {
        await updateAnaliseVisual(selectedService.id, analise.length ? analise : null)
      }
      if ((testes || '') !== (selectedService.testes_realizados || '')) {
        await updateTestesRealizados(selectedService.id, testes.length ? testes : null)
      }
      if ((servicos || '') !== (selectedService.servicos_a_fazer || '')) {
        await updateServicosAFazer(selectedService.id, servicos.length ? servicos : null)
      }
      if ((cert || '') !== (selectedService.numero_certificado || '') || (dataCalib || '') !== (selectedService.data_calibracao ? new Date(selectedService.data_calibracao).toISOString().split('T')[0] : '')) {
          await updateCertificadoCalibracao(selectedService.id, cert.length ? cert : null, dataCalib.length ? dataCalib : null)
      }

      setSelectedService(prev => prev ? {
        ...prev,
        observacoes_equipamento: analise.length ? analise : null,
        testes_realizados: testes.length ? testes : null,
        servicos_a_fazer: servicos.length ? servicos : null,
        numero_certificado: cert.length ? cert : null,
        data_calibracao: dataCalib.length ? dataCalib : null,
        updated_at: new Date().toISOString()
      } : prev)
    } finally {
      setSavingCampos(false)
    }
  }

  const handleAddImagens = async (files: FileList | null) => {
    if (!selectedService || !files?.length) return
    setUploadingImagens(true)
    try {
      const uploadedUrls = await Promise.all(Array.from(files).map(file => uploadImage(file)))
      const current = selectedService.imagens || []
      const merged = Array.from(new Set([...current, ...uploadedUrls]))
      await updateImagens(selectedService.id, merged.length ? merged : null)
      setSelectedService(prev => prev ? { ...prev, imagens: merged.length ? merged : null, updated_at: new Date().toISOString() } : prev)
    } finally {
      setUploadingImagens(false)
    }
  }

  const handleRemoveImagem = async (url: string) => {
    if (!selectedService) return
    const current = selectedService.imagens || []
    const next = current.filter(i => i !== url)
    setUploadingImagens(true)
    try {
      await updateImagens(selectedService.id, next.length ? next : null)
      setSelectedService(prev => prev ? { ...prev, imagens: next.length ? next : null, updated_at: new Date().toISOString() } : prev)
    } finally {
      setUploadingImagens(false)
    }
  }

  const getExpandedFieldConfig = () => {
    switch (expandedField) {
      case 'analise':
        return {
          title: 'Análise Visual / Observações Iniciais',
          value: analiseVisual,
          setValue: setAnaliseVisual,
          icon: <AlertCircle size={24} className="text-amber-500" />,
          placeholder: 'Descreva detalhadamente as condições físicas do equipamento ao chegar...'
        }
      case 'testes':
        return {
          title: 'Testes Realizados',
          value: testesRealizados,
          setValue: setTestesRealizados,
          icon: <Wrench size={24} className="text-blue-500" />,
          placeholder: 'Liste os testes executados e seus resultados...'
        }
      case 'servicos':
        return {
          title: 'Serviços a Serem Executados',
          value: servicosAFazer,
          setValue: setServicosAFazer,
          icon: <Layers size={24} className="text-emerald-500" />,
          placeholder: 'Defina o escopo do serviço a ser realizado...'
        }
      default:
        return null
    }
  }

  return (
    <div className={`h-full min-h-0 w-full min-w-0 overflow-x-hidden flex flex-col ${isTvMode ? 'p-2' : 'pt-4 pb-6 max-w-[1800px] mx-auto px-4 md:px-6'}`}>
      {!isTvMode && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 shrink-0">
          <h2 className="text-xs font-bold tracking-widest uppercase text-[var(--text-soft)]">
            Produção / Ordens de Serviços
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => toggleTvMode()}
              className="h-9 px-4 rounded-xl bg-white/5 border border-[var(--border)] text-sm text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-white/10 transition flex items-center justify-center gap-2"
              title="Entrar em Modo TV"
            >
              <Monitor size={14} />
              Modo TV
            </button>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="h-9 px-4 rounded-xl bg-white/5 border border-[var(--border)] text-sm text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-white/10 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <ServiceKanbanBoard 
            services={services} 
            loading={loading} 
            usuarios={usuarios}
            onDragEnd={onDragEnd}
            onCardClick={setSelectedService}
            isTvMode={isTvMode}
        />
      </div>

      {/* Detalhes do Serviço Modal */}
      <Modal
        isOpen={!!selectedService}
        onClose={handleCloseModal}
        title={
          <div className="flex items-center gap-4">
             <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Wrench size={24} />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Ordem de Serviço</span>
                <span className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{selectedService?.id_rst || '...'}</span>
             </div>
             {selectedService?.fase && (
                <button 
                  onClick={handleOpenFaseModal}
                  className="ml-4 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-[var(--primary)]/20"
                >
                  <ArrowRight size={14} />
                  Movimentar Equipamento
                </button>
             )}
          </div>
        }
        size="full"
        className="max-w-[95vw] h-[90vh]"
        footer={
          selectedService ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                 <span className="flex items-center gap-1.5"><Calendar size={14}/> Entrada: {new Date(selectedService.data_entrada).toLocaleDateString()}</span>
                 <span className="w-px h-3 bg-[var(--border)]"></span>
                 <span className="flex items-center gap-1.5"><User size={14}/> Resp: {selectedService.responsavel || '-'}</span>
                 <span className="w-px h-3 bg-[var(--border)]"></span>
                 <button 
                    onClick={() => setShowHistorico(true)}
                    className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
                 >
                    <History size={14}/> Histórico
                 </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCloseModal}
                  className="h-11 px-6 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors font-medium"
                  disabled={savingCampos || uploadingImagens}
                >
                  Fechar
                </button>
                <button
                  onClick={handleSalvarCampos}
                  disabled={!camposDirty || savingCampos || uploadingImagens}
                  className="h-11 px-8 rounded-xl bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary)]/20"
                >
                  {savingCampos ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedService && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Sidebar Esquerda - Informações (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar content-start">
                    
                    {/* Card Principal - Cliente */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={16} className="text-[var(--primary)]" />
                            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Dados do Cliente</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="text-xl font-bold text-[var(--text-main)] leading-tight">{selectedService.cliente}</div>
                                {selectedService.cnpj && <div className="text-xs text-[var(--text-soft)] mt-1 font-mono">{selectedService.cnpj}</div>}
                            </div>
                            
                            {selectedService.endereco && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-main)]/50 border border-[var(--border)]">
                                    <MapPin size={16} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                                    <div className="text-sm text-[var(--text-main)] leading-relaxed">{selectedService.endereco}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Proposta</label>
                                    <div className="text-lg font-bold text-cyan-400">{selectedService.cod_proposta}</div>
                                </div>
                                {selectedService.etapa_omie && (
                                    <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Etapa Omie</label>
                                        <div className="text-sm font-medium text-[var(--text-soft)]">{selectedService.etapa_omie}</div>
                                    </div>
                                )}
                                <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] col-span-2 flex items-center justify-between">
                                    <div>
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block flex items-center gap-1.5">
                                            <Timer size={12} />
                                            Tempo Total
                                        </label>
                                        <div className="text-lg font-bold text-[var(--text-main)]">{formatDuration(selectedService.data_entrada)}</div>
                                    </div>
                                    <div className="text-right">
                                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block flex items-center gap-1.5 justify-end">
                                            <Hourglass size={12} />
                                            Nesta Fase
                                        </label>
                                        <div className={`text-lg font-bold ${getStatusDurationColor(selectedService.data_fase_atual)}`}>
                                            {formatDuration(selectedService.data_fase_atual || selectedService.updated_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card Vendedor */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <User size={16} className="text-[var(--primary)]" />
                            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Vendedor Responsável</h3>
                        </div>
                        
                        <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full border-2 border-[var(--border)] bg-[var(--bg-main)] overflow-hidden flex items-center justify-center shrink-0">
                                {vendedorUser?.avatar_url ? (
                                    <img src={vendedorUser.avatar_url} alt={selectedService.vendedor || ''} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-bold text-[var(--text-muted)]">
                                        {(selectedService.vendedor || '??').substring(0, 2).toUpperCase()}
                                    </span>
                                )}
                             </div>
                             <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-[var(--text-main)] truncate">{selectedService.vendedor || 'Não informado'}</span>
                                <span className="text-xs text-[var(--text-soft)] truncate">{selectedService.email_vendedor || vendedorUser?.email_corporativo || vendedorUser?.email_login || '-'}</span>
                             </div>
                        </div>
                    </div>

                    {/* Card Equipamento */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <Layers size={16} className="text-[var(--primary)]" />
                            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Equipamento</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="col-span-2 p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Modelo</label>
                                <div className="text-base font-semibold text-[var(--text-main)]">{selectedService.modelo || '-'}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Fabricante</label>
                                <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.fabricante || '-'}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Nº Série</label>
                                <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.numero_serie || '-'}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">TAG</label>
                                <div className="text-sm font-medium text-[var(--text-main)] truncate">{selectedService.tag || '-'}</div>
                            </div>
                             <div className="p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Garantia</label>
                                <div className={`text-sm font-bold ${selectedService.garantia ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                                    {selectedService.garantia ? 'SIM' : 'NÃO'}
                                </div>
                            </div>
                        </div>
                        
                        {/* Certificado e Calibração */}
                        <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-[var(--bg-main)]/50 border border-[var(--border)]">
                           <div>
                              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Nº Certificado</label>
                              <input
                                type="text"
                                value={numeroCertificado}
                                onChange={(e) => setNumeroCertificado(e.target.value)}
                                placeholder="---"
                                className="w-full bg-transparent text-sm font-medium text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-b border-[var(--primary)] transition-colors"
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 block">Data Calibração</label>
                              <input
                                type="date"
                                value={dataCalibracao}
                                onChange={(e) => setDataCalibracao(e.target.value)}
                                className="w-full bg-transparent text-sm font-medium text-[var(--text-main)] focus:outline-none focus:border-b border-[var(--primary)] transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                              />
                           </div>
                        </div>

                        <div className="space-y-3">
                             <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] border-dashed">
                                <span className="text-xs font-medium text-[var(--text-muted)]">NF de Entrada</span>
                                <span className="text-sm font-bold text-[var(--text-main)]">{selectedService.numero_nf || '-'}</span>
                             </div>
                             <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] border-dashed">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Pedido</span>
                                <span className="text-sm font-bold text-[var(--text-main)]">{selectedService.numero_pedido || '-'}</span>
                             </div>
                        </div>

                        {selectedService.solucao && (
                            <div className="mt-6 pt-4 border-t border-[var(--border)]">
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-2 block">Solução Solicitada</label>
                                <p className="text-sm text-[var(--text-soft)] italic leading-relaxed">"{selectedService.solucao}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna Direita - Área Técnica (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-4">
                        
                        {/* Seção 1: Análise Visual */}
                        <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <label className="flex items-center gap-3 text-sm font-bold text-[var(--text-main)] uppercase tracking-wide">
                                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                                        <AlertCircle size={18} />
                                    </div>
                                    Análise Visual / Observações Iniciais
                                </label>
                                <button 
                                    onClick={() => setExpandedField('analise')}
                                    className="p-2 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                    title="Expandir"
                                >
                                    <Maximize2 size={16} />
                                </button>
                            </div>
                            <textarea
                              value={analiseVisual}
                              onChange={(e) => setAnaliseVisual(e.target.value)}
                              rows={6}
                              placeholder="Descreva detalhadamente as condições físicas do equipamento ao chegar..."
                              className="w-full p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all resize-none leading-relaxed"
                              disabled={savingCampos || uploadingImagens}
                            />
                        </div>

                        {/* Seção 2: Grid Técnico */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="flex items-center gap-3 text-sm font-bold text-[var(--text-main)] uppercase tracking-wide">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                            <Wrench size={18} />
                                        </div>
                                        Testes Realizados
                                    </label>
                                    <button 
                                        onClick={() => setExpandedField('testes')}
                                        className="p-2 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                        title="Expandir"
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                </div>
                                <textarea
                                  value={testesRealizados}
                                  onChange={(e) => setTestesRealizados(e.target.value)}
                                  placeholder="Liste os testes executados e seus resultados..."
                                  className="w-full flex-1 min-h-[160px] p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all resize-none leading-relaxed"
                                  disabled={savingCampos || uploadingImagens}
                                />
                            </div>

                            <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="flex items-center gap-3 text-sm font-bold text-[var(--text-main)] uppercase tracking-wide">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                            <Layers size={18} />
                                        </div>
                                        Serviços a Serem Executados
                                    </label>
                                    <button 
                                        onClick={() => setExpandedField('servicos')}
                                        className="p-2 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                                        title="Expandir"
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                </div>
                                <textarea
                                  value={servicosAFazer}
                                  onChange={(e) => setServicosAFazer(e.target.value)}
                                  placeholder="Defina o escopo do serviço a ser realizado..."
                                  className="w-full flex-1 min-h-[160px] p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all resize-none leading-relaxed"
                                  disabled={savingCampos || uploadingImagens}
                                />
                            </div>
                        </div>

                        {/* Seção 3: Imagens */}
                        <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <label className="flex items-center gap-3 text-sm font-bold text-[var(--text-main)] uppercase tracking-wide">
                                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                                        <Tag size={18} />
                                    </div>
                                    Galeria de Imagens
                                </label>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setGalleryEditMode(v => !v)}
                                    disabled={savingCampos || uploadingImagens}
                                    className={`h-10 px-4 rounded-xl border transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${
                                      galleryEditMode
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15'
                                        : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)]'
                                    } disabled:opacity-50`}
                                    title={galleryEditMode ? 'Sair do modo de edição' : 'Entrar no modo de edição para apagar imagens'}
                                  >
                                    {galleryEditMode ? <CheckCircle2 size={16} /> : <Pencil size={16} />}
                                    {galleryEditMode ? 'Concluir' : 'Editar'}
                                  </button>

                                  <label className={`
                                      group flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] 
                                      hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all cursor-pointer
                                      ${uploadingImagens ? 'opacity-50 pointer-events-none' : ''}
                                  `}>
                                      <Upload size={16} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                                      <span className="text-sm font-medium text-[var(--text-main)] group-hover:text-[var(--primary)]">Adicionar Imagens</span>
                                      <input
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept="image/*"
                                        disabled={uploadingImagens}
                                        onChange={(e) => {
                                          handleAddImagens(e.target.files)
                                          e.currentTarget.value = ''
                                        }}
                                      />
                                  </label>
                                </div>
                            </div>

                            {(selectedService.imagens && selectedService.imagens.length > 0) ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                {selectedService.imagens.map((url, i) => (
                                  <div key={`${url}-${i}`} className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-main)] shadow-sm hover:shadow-md transition-all">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImageUrl(url)}
                                      className="block w-full h-full"
                                      title="Visualizar maior"
                                    >
                                      <img src={url} alt={`Imagem ${i}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    </button>

                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-200 pointer-events-none" />

                                    <div className="absolute bottom-2 left-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">
                                      <div className="p-2 rounded-lg bg-black/60 text-white shadow-sm">
                                        <Maximize2 size={14} />
                                      </div>
                                    </div>

                                    {galleryEditMode && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveImageUrl(url)}
                                        disabled={uploadingImagens || savingCampos}
                                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 translate-y-[-10px] group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 hover:bg-rose-600 shadow-sm disabled:opacity-50"
                                        title="Remover imagem"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-main)]/30">
                                <div className="p-4 rounded-full bg-[var(--bg-panel)] mb-3">
                                    <Tag size={24} className="text-[var(--text-muted)] opacity-50" />
                                </div>
                                <p className="text-sm font-medium text-[var(--text-muted)]">Nenhuma imagem anexada a este serviço</p>
                              </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </Modal>

      <Modal
        isOpen={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        title={
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <ZoomIn size={18} />
              </div>
              <span className="font-bold text-lg text-[var(--text-main)] truncate">Visualização da Imagem</span>
            </div>
            {previewImageUrl && (
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-xl bg-white/5 border border-[var(--border)] text-sm text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-white/10 transition flex items-center justify-center gap-2 shrink-0"
                title="Abrir em nova aba"
              >
                <ExternalLink size={14} />
                Abrir
              </a>
            )}
          </div>
        }
        size="full"
        className="h-[90vh]"
        noPadding
        scrollableContent={false}
        zIndex={130}
      >
        <div className="h-full w-full flex items-center justify-center bg-black/30">
          {previewImageUrl && (
            <img
              src={previewImageUrl}
              alt="Imagem"
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl border border-white/10 shadow-2xl"
            />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmRemoveImageUrl}
        onClose={() => setConfirmRemoveImageUrl(null)}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Trash2 size={18} />
            </div>
            <span className="font-bold text-lg">Apagar imagem?</span>
          </div>
        }
        size="md"
        zIndex={140}
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              onClick={() => setConfirmRemoveImageUrl(null)}
              className="h-11 px-6 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors font-medium"
              disabled={uploadingImagens}
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!confirmRemoveImageUrl) return
                const url = confirmRemoveImageUrl
                setConfirmRemoveImageUrl(null)
                await handleRemoveImagem(url)
              }}
              className="h-11 px-6 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20"
              disabled={uploadingImagens || savingCampos}
            >
              Apagar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-soft)] leading-relaxed">
            Esta ação remove a imagem da ordem de serviço.
          </p>
          {confirmRemoveImageUrl && (
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-main)]">
              <img src={confirmRemoveImageUrl} alt="Prévia" className="w-full max-h-[40vh] object-contain bg-black/20" />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Histórico */}
      <Modal
        isOpen={showHistorico}
        onClose={() => setShowHistorico(false)}
        title={
          <div className="flex items-center gap-3">
             <History size={24} className="text-[var(--primary)]" />
             <span className="font-bold text-lg">Histórico de Movimentação</span>
          </div>
        }
        size="lg"
        zIndex={120}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {loadingHistorico ? (
                <div className="flex justify-center py-8">
                    <RefreshCw className="animate-spin text-[var(--text-muted)]" size={24} />
                </div>
            ) : historico.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                    Nenhum registro de movimentação encontrado.
                </div>
            ) : (
                <div className="relative border-l-2 border-[var(--border)] ml-3 my-2 space-y-8">
                    {historico.map((h, i) => (
                        <div key={h.id} className="relative pl-6">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--bg-main)] border-2 border-[var(--primary)]" />
                            <div className="flex flex-col gap-1">
                                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                    <Clock size={12} />
                                    {new Date(h.data_movimentacao).toLocaleString()}
                                    <span className="text-[var(--text-soft)]">•</span>
                                    <span>{h.profiles?.nome || 'Sistema'}</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] space-y-2">
                                    {h.fase_origem !== h.fase_destino && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-medium text-[var(--text-soft)]">{h.fase_origem ? getOsPhaseConfig(h.fase_origem).label : ''}</span>
                                            <ArrowRight size={14} className="text-[var(--text-muted)]" />
                                            <span className="font-bold text-[var(--text-main)]">{h.fase_destino ? getOsPhaseConfig(h.fase_destino).label : ''}</span>
                                        </div>
                                    )}
                                    {h.responsavel_origem !== h.responsavel_destino && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <User size={12} className="text-[var(--text-muted)]" />
                                            <span className="text-[var(--text-soft)]">{h.responsavel_origem || 'Sem resp.'}</span>
                                            <ArrowRight size={12} className="text-[var(--text-muted)]" />
                                            <span className="text-[var(--text-main)] font-medium">{h.responsavel_destino || 'Sem resp.'}</span>
                                        </div>
                                    )}
                                    {String(h.descricao || '').trim().length > 0 && (
                                        <div className="flex items-start gap-2 text-xs">
                                            <FileText size={12} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                                            <span className="text-[var(--text-soft)] leading-relaxed whitespace-pre-wrap">
                                              {String(h.descricao).trim()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </Modal>

      {/* Modal de Mudança de Fase */}
      <Modal
        isOpen={showFaseModal}
        onClose={() => setShowFaseModal(false)}
        title={
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Layers size={24} />
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Ação de Fluxo</span>
               <span className="font-bold text-lg text-[var(--text-main)]">Mover Equipamento</span>
             </div>
          </div>
        }
        size="lg"
        zIndex={130}
        footer={
            <div className="flex justify-end gap-3 w-full">
                <button
                  onClick={() => setShowFaseModal(false)}
                  className="h-10 px-4 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFase}
                  disabled={!nextDescricao.trim()}
                  className="h-10 px-6 rounded-xl bg-[var(--primary)] text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary)]/20 flex items-center gap-2"
                >
                  Confirmar Movimentação
                  <ArrowRight size={16} />
                </button>
            </div>
        }
      >
        <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-3 block flex items-center gap-2">
                        <Layers size={14} />
                        Selecione a Nova Fase
                    </label>
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 p-1">
                        {ETAPAS_SERVICOS.map(fase => {
                            const config = getOsPhaseConfig(fase)
                            const isSelected = nextFase === fase
                            return (
                            <button
                                key={fase}
                                onClick={() => setNextFase(fase)}
                                className={`group relative p-3 rounded-xl border text-left text-sm transition-all duration-200 ${
                                    isSelected 
                                    ? `${config.bg} ${config.border} ring-1 ring-[var(--primary)] shadow-md` 
                                    : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)] hover:shadow-sm'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`font-bold ${isSelected ? config.color : 'text-[var(--text-main)]'}`}>
                                        {config.label}
                                    </span>
                                    {isSelected && <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />}
                                </div>
                            </button>
                        )})}
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block flex items-center gap-2">
                            <User size={14} />
                            Responsável pela Fase
                        </label>
                        <select
                            value={nextResponsavel}
                            onChange={(e) => setNextResponsavel(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                        >
                            <option value="">Selecione um responsável...</option>
                            {usuarios.map(u => (
                                <option key={u.id} value={u.nome}>
                                    {u.nome} {u.cargo ? `(${u.cargo})` : ''}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
                            Selecione quem será o responsável técnico ou administrativo por acompanhar o equipamento nesta nova etapa.
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block flex items-center gap-2">
                            <History size={14} />
                            Descrição da Movimentação <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={nextDescricao}
                            onChange={(e) => setNextDescricao(e.target.value)}
                            placeholder="Descreva o que foi realizado, motivo da mudança ou observações importantes para o histórico..."
                            className="w-full h-[140px] p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none leading-relaxed"
                        />
                    </div>
                </div>
            </div>
        </div>
      </Modal>

      {/* Modal Expandido - Movido para DEPOIS do modal principal para garantir z-index correto sem precisar forçar */}
      <Modal
        isOpen={!!expandedField}
        onClose={() => setExpandedField(null)}
        title={
          <div className="flex items-center gap-3">
             {getExpandedFieldConfig()?.icon}
             <span className="font-bold text-lg">{getExpandedFieldConfig()?.title}</span>
          </div>
        }
        size="xl"
        zIndex={110} // Forçando zIndex maior para garantir
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setExpandedField(null)}
              className="h-10 px-6 rounded-xl bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all"
            >
              Concluir Edição
            </button>
          </div>
        }
      >
        {expandedField && (
            <textarea
              value={getExpandedFieldConfig()?.value || ''}
              onChange={(e) => getExpandedFieldConfig()?.setValue(e.target.value)}
              placeholder={getExpandedFieldConfig()?.placeholder}
              className="w-full h-[60vh] p-6 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] text-lg placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all resize-none leading-relaxed"
              autoFocus
            />
        )}
      </Modal>

      {/* Modal de Alerta / Bloqueio */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                    alertModal.type === 'error' ? 'bg-rose-500/10 text-rose-500' :
                    alertModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-amber-500/10 text-amber-500'
                }`}>
                    {alertModal.type === 'error' ? <AlertCircle size={24} /> :
                     alertModal.type === 'success' ? <CheckCircle2 size={24} /> :
                     <AlertTriangle size={24} />}
                </div>
                <span className="font-bold text-lg">{alertModal.title}</span>
            </div>
        }
        size="md"
        zIndex={200}
        footer={
            <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className="h-10 px-6 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-panel)] transition-colors font-medium text-sm w-full sm:w-auto"
            >
                Entendido
            </button>
        }
      >
        <div className="py-2">
            {alertModal.message}
        </div>
      </Modal>
    </div>
  )
}

export default OrdensServico
