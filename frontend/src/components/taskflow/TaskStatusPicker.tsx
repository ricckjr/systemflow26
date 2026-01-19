import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface TaskStatusPickerColumn {
  id: string;
  name: string;
}

interface TaskStatusPickerProps {
  columns: TaskStatusPickerColumn[];
  currentColumnId: string;
  onSelect: (columnId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
}

export const TaskStatusPicker: React.FC<TaskStatusPickerProps> = ({
  columns,
  currentColumnId,
  onSelect,
  disabled = false,
  isLoading = false,
  label = 'Alterar status',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => {
    return columns.map(c => ({
      ...c,
      isCurrent: c.id === currentColumnId,
    }));
  }, [columns, currentColumnId]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) setOpen(false);
    };

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open]);

  const isDisabled = disabled || isLoading || options.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm font-semibold text-[var(--text-main)] hover:border-cyan-500/30 transition-colors disabled:opacity-60 disabled:hover:border-[var(--border)]"
      >
        <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
          {isLoading ? 'Movendo...' : label}
        </span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-full bg-[var(--bg-panel)] rounded-xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {options.map(c => {
              const optionDisabled = c.isCurrent || isLoading;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  disabled={optionDisabled}
                  onClick={() => {
                    if (optionDisabled) return;
                    setOpen(false);
                    onSelect(c.id);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    c.isCurrent
                      ? 'bg-cyan-500/10 text-cyan-300 font-bold'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]'
                  } ${optionDisabled ? 'opacity-60' : ''}`}
                >
                  <span className="truncate">{c.name}</span>
                  {c.isCurrent && <Check size={14} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

