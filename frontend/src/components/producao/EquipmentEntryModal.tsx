import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ServicEquipamento } from '@/types/domain'
import { useServicsEquipamento } from '@/hooks/useServicsEquipamento'
import { Loader2, Upload, X } from 'lucide-react'

interface EquipmentEntryModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: Partial<ServicEquipamento>
  onSuccess: () => void
}

export const EquipmentEntryModal: React.FC<EquipmentEntryModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess
}) => {
  const { addService, uploadImage } = useServicsEquipamento()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  
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
    tag: '',
    garantia: false,
    faixa: '',
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
    setUploading(true)
    try {
      const files = Array.from(e.target.files)
      const urls = await Promise.all(files.map(file => uploadImage(file)))
      setFormData(prev => ({
        ...prev,
        imagens: [...(prev.imagens || []), ...urls]
      }))
    } catch (error) {
      console.error('Erro ao fazer upload', error)
      alert('Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imagens: prev.imagens?.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
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

      console.log('Enviando payload:', cleanPayload) // Debug
      
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
      alert(error.message || 'Erro ao criar registro de equipamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Entrada de Equipamento"
      size="2xl"
      zIndex={1050}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* New Fields - NF and Order */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Número NF</label>
            <input 
              name="numero_nf"
              value={formData.numero_nf || ''}
              onChange={handleChange}
              placeholder="Ex: 12345"
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Número Pedido</label>
            <input 
              name="numero_pedido"
              value={formData.numero_pedido || ''}
              onChange={handleChange}
              placeholder="Ex: PED-001"
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* New Fields - ID RST removed as requested */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">TAG</label>
            <input 
              name="tag"
              value={formData.tag || ''}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Fabricante</label>
            <input 
              name="fabricante"
              value={formData.fabricante || ''}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Modelo</label>
            <input 
              name="modelo"
              value={formData.modelo || ''}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Nº Série</label>
            <input 
              name="numero_serie"
              value={formData.numero_serie || ''}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Faixa</label>
            <input 
              name="faixa"
              value={formData.faixa || ''}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

           <div className="space-y-1 md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                name="garantia"
                checked={formData.garantia || false}
                onChange={handleChange}
                className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-panel)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-sm font-medium text-[var(--text-main)]">Garantia</span>
            </label>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Observações (Análise Visual)</label>
            <textarea 
              name="observacoes_equipamento"
              value={formData.observacoes_equipamento || ''}
              onChange={handleChange}
              rows={3}
              className="w-full p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Imagens</label>
            <div className="flex flex-wrap gap-3">
              {formData.imagens?.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] group">
                  <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-main)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)]">
                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                <span className="text-[10px] mt-1">Upload</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="px-6 py-2 rounded-xl bg-[var(--primary)] text-white font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Confirmar Entrada
          </button>
        </div>
      </form>
    </Modal>
  )
}
