import type { SupabaseClient } from '@supabase/supabase-js'

type RealtimeListener = (state: { connectionState: string; at: number }) => void

declare global {
  // eslint-disable-next-line no-var
  var __systemflow_realtime_setup: boolean | undefined
  // eslint-disable-next-line no-var
  var __systemflow_realtime_token: string | null | undefined
  // eslint-disable-next-line no-var
  var __systemflow_realtime_listeners: Set<RealtimeListener> | undefined
  // eslint-disable-next-line no-var
  var __systemflow_realtime_last_state: { connectionState: string; at: number } | undefined
}

function getSocket(client: any) {
  try {
    return client?.realtime?.socket ?? null
  } catch {
    return null
  }
}

function getConnectionState(sock: any) {
  try {
    const raw = sock?.connectionState?.() ?? sock?.conn?.readyState ?? sock?.state
    return raw == null ? 'unknown' : String(raw)
  } catch {
    return 'unknown'
  }
}

function emit(state: { connectionState: string; at: number }) {
  globalThis.__systemflow_realtime_last_state = state
  const listeners = globalThis.__systemflow_realtime_listeners
  if (!listeners || listeners.size === 0) return
  for (const fn of Array.from(listeners)) {
    try {
      fn(state)
    } catch {
    }
  }
}

export function onRealtimeStatus(listener: RealtimeListener) {
  globalThis.__systemflow_realtime_listeners = globalThis.__systemflow_realtime_listeners ?? new Set()
  globalThis.__systemflow_realtime_listeners.add(listener)
  try {
    const last = globalThis.__systemflow_realtime_last_state
    if (last) listener(last)
  } catch {
  }
  return () => {
    try {
      globalThis.__systemflow_realtime_listeners?.delete(listener)
    } catch {
    }
  }
}

export function setRealtimeAuth(client: SupabaseClient<any>, accessToken: string | null | undefined) {
  const token = accessToken ?? ''
  if (globalThis.__systemflow_realtime_token === token) return
  globalThis.__systemflow_realtime_token = token
  try {
    ;(client as any).realtime?.setAuth?.(token)
  } catch {
  }
}

export function setupRealtimeAutoRecover(client: SupabaseClient<any>) {
  if (globalThis.__systemflow_realtime_setup) return
  globalThis.__systemflow_realtime_setup = true

  let lastState = 'unknown'
  const poll = window.setInterval(() => {
    const sock = getSocket(client as any)
    const state = getConnectionState(sock)
    if (state === lastState) return
    lastState = state
    emit({ connectionState: state, at: Date.now() })
  }, 800)

  const tryConnect = () => {
    try {
      const r = (client as any).realtime
      const sock = getSocket(client as any)
      const state = getConnectionState(sock)
      if (state === 'open') return
      if (typeof r?.connect === 'function') r.connect()
    } catch {
    }
  }

  window.addEventListener('online', tryConnect)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryConnect()
  })

  if ((import.meta as any).hot) {
    ;(import.meta as any).hot.dispose(() => {
      window.clearInterval(poll)
      window.removeEventListener('online', tryConnect)
    })
  }
}

