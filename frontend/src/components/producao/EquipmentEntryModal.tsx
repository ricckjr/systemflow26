import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ServicEquipamento } from '@/types/domain'
import { useServicsEquipamento } from '@/hooks/useServicsEquipamento'
import { fetchCrmStatus, fetchOportunidadeByCodigoProposta, updateOportunidade } from '@/services/crm'
import { AlertTriangle, Loader2, Upload, Wrench, X } from 'lucide-react'

interface EquipmentEntryModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: Partial<ServicEquipamento>
  onSuccess: () => void
}

const normalizeText = (v: string) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()

const AUTO_STATUS_DESC = 'ANÁLISE TÉCNICA'

export const EquipmentEntryModal: React.FC<EquipmentEntryModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess
}) => {
  const { addService, uploadImage } = useServicsEquipamento()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const uploadingRef = React.useRef(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  
  const [formData, setFormData] = useState<Partial<ServicEquipamento>>({
    cod_proposta: '',
    cliente: '',
    cnpj: '',
    endereco: '',
    solucao: '',
    etapa_omie: '',
    modelo: '',
    fabricante: '',
    numero_serie: '',
    numero_serie2: '',
    tag: '',
    garantia: false,
    faixa: '',
    solicitacao_cliente: '',
    observacoes_equipamento: '',
    imagens: [],
    data_entrada: new Date().toISOString(),
    fase: 'ANALISE',
    ...initialData
  })

  // Sincroniza o formData quando o initialData muda
  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData
      }))
    }
  }, [initialData])

  const uploadFiles = React.useCallback(async (files: File[]) => {
    const list = (files || []).filter((f) => f && String(f.type || '').startsWith('image/'))
    if (!list.length) return
    if (uploadingRef.current) return
    uploadingRef.current = true
    setErrorMessage(null)
    setUploading(true)
    try {
      const urls = await Promise.all(list.map((file) => uploadImage(file)))
      setFormData((prev) => ({
        ...prev,
        imagens: [...(prev.imagens || []), ...urls]
      }))
    } catch (error) {
      console.error('Erro ao fazer upload', error)
      setErrorMessage('Erro ao fazer upload da imagem.')
    } finally {
      setUploading(false)
      uploadingRef.current = false
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [uploadImage])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked
        setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
        setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    void uploadFiles(Array.from(e.target.files))
  }

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imagens: prev.imagens?.filter((_, i) => i !== index)
    }))
  }

  React.useEffect(() => {
    if (!isOpen) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind !== 'file') continue
        const f = item.getAsFile()
        if (f && String(f.type || '').startsWith('image/')) files.push(f)
      }
      if (!files.length) return
      e.preventDefault()
      void uploadFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [isOpen, uploadFiles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)
    try {
      // Clean payload construction with type safety
      const basePayload = {
        ...formData,
        // Fallbacks
        cliente: formData.cliente || initialData.cliente,
        cod_proposta: formData.cod_proposta || initialData.cod_proposta,
        cnpj: formData.cnpj || initialData.cnpj,
        solucao: formData.solucao || initialData.solucao,
        etapa_omie: formData.etapa_omie || initialData.etapa_omie,
        endereco: formData.endereco || initialData.endereco
      }
      
      const cleanPayload: Partial<ServicEquipamento> = {}
      for (const [key, value] of Object.entries(basePayload)) {
        if (value !== undefined && value !== null && value !== '') {
          ;(cleanPayload as any)[key] = value
        }
      }
      
      // Validation
      if (!cleanPayload.cliente || !cleanPayload.cod_proposta) {
          console.error('Dados faltando:', { cleanPayload, initialData, formData })
          throw new Error('Cliente e Código da Proposta são obrigatórios. Tente fechar e abrir o modal novamente.')
      }

      await addService(cleanPayload as any)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error(error)
      setErrorMessage(error.message || 'Erro ao criar registro de equipamento')
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    'w-full h-9 px-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors'
  const textareaBase =
    'w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors resize-none'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] shrink-0">
            <Wrench size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Entrada de Equipamento</div>
            <div className="text-base font-bold text-[var(--text-main)] truncate">
              {formData.cod_proposta ? `Proposta ${formData.cod_proposta}` : 'Nova entrada'}
            </div>
            {!!formData.cliente && <div className="text-xs text-[var(--text-muted)] truncate">{formData.cliente}</div>}
          </div>
        </div>
      }
      size="2xl"
      zIndex={1050}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors"
          >
            Cancelar
          </button>
          <button
            form="equipment-entry-form"
            type="submit"
            disabled={loading || uploading}
            className="px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Confirmar entrada
          </button>
        </>
      }
    >
      <form id="equipment-entry-form" onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
          <div className="text-xs font-bold text-[var(--text-main)] mb-3">Identificação</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Número NF</label>
              <input
                name="numero_nf"
                value={formData.numero_nf || ''}
                onChange={handleChange}
                placeholder="Ex: 12345"
                className={inputBase}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Número Pedido</label>
              <input
                name="numero_pedido"
                value={formData.numero_pedido || ''}
                onChange={handleChange}
                placeholder="Ex: PED-001"
                className={inputBase}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
          <div className="text-xs font-bold text-[var(--text-main)] mb-3">Solicitação do Cliente</div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Descrição</label>
            <textarea
              name="solicitacao_cliente"
              value={formData.solicitacao_cliente || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Descreva a solicitação do cliente..."
              className={textareaBase}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
          <div className="text-xs font-bold text-[var(--text-main)] mb-3">Dados do equipamento</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">TAG</label>
              <input name="tag" value={formData.tag || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Fabricante</label>
              <input name="fabricante" value={formData.fabricante || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Modelo</label>
              <input name="modelo" value={formData.modelo || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Nº Série 1</label>
              <input name="numero_serie" value={formData.numero_serie || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Nº Série 2</label>
              <input name="numero_serie2" value={formData.numero_serie2 || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Faixa</label>
              <input name="faixa" value={formData.faixa || ''} onChange={handleChange} className={inputBase} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="garantia"
                  checked={formData.garantia || false}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-main)] text-[var(--primary)] focus:ring-[var(--primary)]/30"
                />
                <span className="text-sm font-semibold text-[var(--text-main)]">Garantia</span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
          <div className="text-xs font-bold text-[var(--text-main)] mb-3">Análise visual</div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Observações</label>
            <textarea
              name="observacoes_equipamento"
              value={formData.observacoes_equipamento || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: riscos, amassados, acessórios faltantes..."
              className={textareaBase}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]/40 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-bold text-[var(--text-main)]">Imagens</div>
            <label className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] hover:border-[var(--primary)]/30 hover:bg-[var(--bg-main)] transition-colors cursor-pointer">
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              <span className="text-xs font-bold">Adicionar</span>
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault()
              if (!uploading) setDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!uploading) setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragActive(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              if (uploading) return
              const files = Array.from(e.dataTransfer?.files || [])
              void uploadFiles(files)
            }}
            className={`mb-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors cursor-pointer select-none ${
              dragActive
                ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10 text-[var(--text-main)]'
                : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[var(--primary)]/30'
            }`}
          >
            Arraste e solte a imagem aqui, clique para selecionar, ou cole com Ctrl+V.
          </div>

          {formData.imagens?.length ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {formData.imagens.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] group bg-[var(--bg-main)]">
                  <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remover imagem"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">Nenhuma imagem adicionada.</div>
          )}
        </div>
      </form>
    </Modal>
  )
}
