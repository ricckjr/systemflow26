import React from 'react';
import { Modal } from './Modal';
import { LogOut } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <LogOut size={18} />
            </div>
            Encerrar sessão
        </div>
      }
      footer={
        <>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border)]
                         px-4 py-2.5 text-[13px] font-medium
                         text-[var(--text-muted)]
                         hover:text-[var(--text-main)] hover:bg-[var(--bg-body)]
                         transition"
            >
              Cancelar
            </button>

            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl
                         px-4 py-2.5 text-[13px] font-semibold
                         bg-red-500 hover:bg-red-600
                         text-white
                         transition shadow-sm"
            >
              Sair
            </button>
        </>
      }
    >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            Tem certeza que deseja sair do sistema agora?
          </p>
        </div>
    </Modal>
  );
};
