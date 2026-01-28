import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import router from '@/routes'

type ToastKind = 'system' | 'chat'

type ToastInput = {
  kind: ToastKind
  title: string
  message?: string
  durationMs?: number
  onClick?: () => void
}

type ToastItem = {
  id: string
  kind: ToastKind
  title: string
  message?: string
  createdAt: number
  onClick?: () => void
}

type ToastContextType = {
  pushToast: (input: ToastInput) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

function randomId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) window.clearTimeout(timer)
    timersRef.current.delete(id)
  }, [])

  const dismissAll = useCallback(() => {
    setItems([])
    for (const timer of timersRef.current.values()) window.clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = randomId()
      const durationMs = Number.isFinite(input.durationMs) ? Math.max(1200, Number(input.durationMs)) : 5200
      const createdAt = Date.now()

      setItems((prev) => [{ id, kind: input.kind, title: input.title, message: input.message, createdAt, onClick: input.onClick }, ...prev].slice(0, 4))

      const timer = window.setTimeout(() => {
        dismissToast(id)
      }, durationMs)
      timersRef.current.set(id, timer)
    },
    [dismissToast]
  )

  const value = useMemo(() => ({ pushToast, dismissToast, dismissAll }), [dismissAll, dismissToast, pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9998] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => {
          const isChat = t.kind === 'chat'
          const titleColor = isChat ? 'text-violet-200' : 'text-cyan-200'
          const border = isChat ? 'border-violet-500/20' : 'border-cyan-500/20'
          const bg = isChat ? 'bg-violet-500/10' : 'bg-cyan-500/10'
          const ring = isChat ? 'hover:ring-violet-500/25' : 'hover:ring-cyan-500/25'

          return (
            <div
              key={t.id}
              className={`group relative overflow-hidden rounded-2xl border ${border} bg-[#0B0F14]/85 backdrop-blur shadow-2xl ring-1 ring-white/10 ${ring}`}
            >
              <button
                type="button"
                onClick={() => {
                  try {
                    t.onClick?.()
                  } catch {}
                  dismissToast(t.id)
                }}
                className="w-full text-left p-3 pr-9"
              >
                <div className={`inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-bold tracking-wide ${bg} ${titleColor}`}>
                  {t.title}
                </div>
                {t.message && (
                  <div className="mt-2 text-[12px] leading-relaxed text-white/85 line-clamp-2">
                    {t.message}
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Fechar"
              >
                <X size={14} />
              </button>

              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute -inset-6 bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-12" />
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function openToastUrl(url: string) {
  try {
    router.navigate(url)
  } catch {
  }
}

