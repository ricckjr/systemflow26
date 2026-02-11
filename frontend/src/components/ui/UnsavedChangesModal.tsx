import React from 'react'
import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'

interface UnsavedChangesModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveAndExit: () => void
  onDiscard: () => void
  saving?: boolean
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onSaveAndExit,
  onDiscard,
  saving = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <TriangleAlert size={18} />
          </div>
          Alterações não salvas
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="flex-1 rounded-xl
                       px-4 py-2.5 text-[13px] font-semibold
                       bg-red-500 hover:bg-red-600
                       text-white
                       transition shadow-sm
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Descartar alterações
          </button>

          <button
            type="button"
            onClick={onSaveAndExit}
            disabled={saving}
            className="flex-1 rounded-xl
                       px-4 py-2.5 text-[13px] font-semibold
                       bg-cyan-600 hover:bg-cyan-500
                       text-white
                       transition shadow-sm
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando…' : 'Salvar e sair'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Você possui alterações não salvas. Deseja sair sem salvar?
        </p>
      </div>
    </Modal>
  )
}

