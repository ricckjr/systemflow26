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
    <div className="rounded-2xl border border-[var(--primary)]/15 bg-[var(--primary)]/5 px-4 py-3 shadow-black/5 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]">
            <Bell size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-main)]">
              Habilite nossas notificações para receber alertas, mensagens e atualizações importantes.
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-soft)]">
              Você pode ajustar preferências separadas para Sistema e Mensagens depois.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onLater}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[12px] font-medium text-[var(--text-soft)] transition-colors hover:bg-white/10 hover:text-[var(--text-main)]"
          >
            Depois
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={onEnable}
            className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)] px-3 py-2 text-[12px] font-semibold text-white shadow-cyan-500/15 transition-colors hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRequesting ? 'Abrindo…' : 'Habilitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

