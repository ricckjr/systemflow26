import React from 'react';
import { Bell } from 'lucide-react';

type NotificationPermissionBannerProps = {
  onEnable: () => void;
  onLater: () => void;
  isRequesting?: boolean;
};

export function NotificationPermissionBanner({
  onEnable,
  onLater,
  isRequesting = false,
}: NotificationPermissionBannerProps) {
  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 shadow-xl shadow-black/5 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Bell size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-main)]">
              Habilite nossas notificações para receber alertas, mensagens e atualizações importantes.
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-soft)]">
              Você pode ajustar preferências separadas para Sistema e Mensagens depois.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onLater}
            className="rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-[12px] font-medium text-[var(--text-soft)] transition-colors hover:bg-white/10 hover:text-[var(--text-main)]"
          >
            Depois
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={onEnable}
            className="rounded-xl border border-cyan-500/25 bg-cyan-600 px-3 py-2 text-[12px] font-semibold text-white shadow-lg shadow-cyan-500/15 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRequesting ? 'Abrindo…' : 'Habilitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

