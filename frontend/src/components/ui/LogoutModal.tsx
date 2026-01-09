import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center
                 bg-black/70 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/5
                   bg-[#0F172A] shadow-2xl p-6
                   animate-in zoom-in-95 fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
      >
        <div className="text-center space-y-4">
          {/* ICON */}
          <div className="mx-auto w-12 h-12 rounded-full
                          bg-red-500/10 border border-red-500/20
                          flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>

          {/* TEXT */}
          <div>
            <h3
              id="logout-title"
              className="text-[15px] font-semibold tracking-wide text-[#E5E7EB]"
            >
              Encerrar sessão
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9CA3AF]">
              Tem certeza que deseja sair do sistema agora?
            </p>
          </div>

          {/* ACTIONS */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10
                         px-4 py-2.5 text-[13px] font-medium
                         text-[#9CA3AF]
                         hover:text-[#E5E7EB] hover:bg-white/5
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
          </div>
        </div>
      </div>
    </div>
  );
};
