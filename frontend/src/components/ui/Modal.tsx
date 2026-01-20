import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  className?: string;
  noPadding?: boolean; // Para casos como Kanban onde o padding atrapalha
  scrollableContent?: boolean; // Se false, o container do conteúdo será overflow-hidden (útil para layouts complexos com scroll interno)
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  noPadding = false,
  scrollableContent = true,
}) => {
  // Prevenir scroll no body quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container */}
      <div 
        className={`
          relative w-full ${sizeClasses[size]} 
          bg-[var(--bg-panel)] 
          rounded-t-2xl md:rounded-2xl 
          shadow-2xl border border-[var(--border)] 
          flex flex-col 
          max-h-[90vh] h-auto
          animate-in slide-in-from-bottom-10 md:zoom-in-95 md:slide-in-from-bottom-0
          ${className}
        `}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[var(--border)] shrink-0 bg-[var(--bg-panel)] rounded-t-2xl">
          <div className="text-lg font-bold text-[var(--text-main)] truncate pr-8 w-full">
            {title}
          </div>
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 md:right-6 md:top-6 p-2 rounded-full hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors z-10"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 ${scrollableContent ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden flex flex-col'} overflow-x-hidden ${noPadding ? '' : 'p-4 md:p-6'}`}>
          {children}
        </div>

        {/* Footer - Fixed */}
        {footer && (
          <div className="p-4 md:p-6 border-t border-[var(--border)] bg-[var(--bg-panel)] rounded-b-2xl shrink-0 flex flex-col sm:flex-row justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
