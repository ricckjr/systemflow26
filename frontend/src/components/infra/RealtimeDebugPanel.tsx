import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, SUPABASE_URL } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'

type ChannelStatus = 'INIT' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
type SoundDebugEvent = {
  type: 'system' | 'chat'
  ok: boolean
  at: number
  error?: string
}

function parseBool(v: string | null) {
  if (!v) return false
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

export function RealtimeDebugPanel() {
  const { session, authReady } = useAuth()
  const userId = session?.user?.id ?? null
  const accessToken = session?.access_token ?? null

  const location = useLocation()
  const enabled = useMemo(() => {
    const qs = new URLSearchParams(location.search)
    return parseBool(qs.get('rtdebug'))
  }, [location.search])

  const [socketState, setSocketState] = useState<string>('unknown')
  const [socketLastOpenAt, setSocketLastOpenAt] = useState<number | null>(null)
  const [socketLastCloseAt, setSocketLastCloseAt] = useState<number | null>(null)
  const [socketLastErrorAt, setSocketLastErrorAt] = useState<number | null>(null)
  const [socketLastClose, setSocketLastClose] = useState<string | null>(null)
  const [channelsCount, setChannelsCount] = useState<number>(0)
  const [broadcastStatus, setBroadcastStatus] = useState<ChannelStatus>('INIT')
  const [broadcastPingOk, setBroadcastPingOk] = useState<boolean | null>(null)

  const [sysStatus, setSysStatus] = useState<ChannelStatus>('INIT')
  const [sysEvents, setSysEvents] = useState(0)

  const [chatStatus, setChatStatus] = useState<ChannelStatus>('INIT')
  const [chatEvents, setChatEvents] = useState(0)
  const [soundEvents, setSoundEvents] = useState<SoundDebugEvent[]>([])
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let alive = true
    let cleanupSocket: null | (() => void) = null
    const tick = window.setInterval(() => {
      if (!alive) return
      try {
        const sock = (supabase as any).realtime?.socket
        const state = sock?.connectionState?.() ?? sock?.conn?.readyState ?? sock?.state ?? 'unknown'
        setSocketState(String(state))
        try {
          const channels = typeof (supabase as any).getChannels === 'function' ? (supabase as any).getChannels() : []
          setChannelsCount(Array.isArray(channels) ? channels.length : 0)
        } catch {
          setChannelsCount(0)
        }

        if (!cleanupSocket && sock) {
          const onOpen =
            typeof sock.onOpen === 'function'
              ? sock.onOpen.bind(sock)
              : typeof sock.connection?.onOpen === 'function'
                ? sock.connection.onOpen.bind(sock.connection)
                : null
          const onClose =
            typeof sock.onClose === 'function'
              ? sock.onClose.bind(sock)
              : typeof sock.connection?.onClose === 'function'
                ? sock.connection.onClose.bind(sock.connection)
                : null
          const onError =
            typeof sock.onError === 'function'
              ? sock.onError.bind(sock)
              : typeof sock.connection?.onError === 'function'
                ? sock.connection.onError.bind(sock.connection)
                : null

          if (onOpen && onClose) {
            const openCb = () => setSocketLastOpenAt(Date.now())
            const closeCb = (ev: any) => {
              setSocketLastCloseAt(Date.now())
              const code = ev?.code ?? ev?.reason ?? ev?.toString?.() ?? ''
              setSocketLastClose(code ? String(code) : 'closed')
            }
            const errCb = () => setSocketLastErrorAt(Date.now())
            try {
              onOpen(openCb)
              onClose(closeCb)
              if (onError) onError(errCb)
              cleanupSocket = () => {
                try {
                  if (typeof sock.off === 'function') {
                    sock.off(openCb)
                    sock.off(closeCb)
                    sock.off(errCb)
                  }
                } catch {}
              }
            } catch {
            }
          }
        }
      } catch {
        setSocketState('unknown')
      }
    }, 800)

    return () => {
      alive = false
      window.clearInterval(tick)
      cleanupSocket?.()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    try {
      ;(supabase as any).realtime?.setAuth?.(accessToken ?? '')
    } catch {}

    setBroadcastPingOk(null)
    setBroadcastStatus('SUBSCRIBING')

    const channel = supabase.channel(
      'systemflow_rtdebug_broadcast',
      { config: { broadcast: { self: true } } } as any
    )

    channel.on('broadcast', { event: 'ping' }, (payload) => {
      const nonce = (payload as any)?.payload?.nonce
      if (!nonce) return
      setBroadcastPingOk(true)
    })

    channel.subscribe((status) => {
      setBroadcastStatus(status as any)
      if (status === 'SUBSCRIBED') {
        try {
          void channel.send({ type: 'broadcast', event: 'ping', payload: { nonce: String(Date.now()) } } as any)
          window.setTimeout(() => setBroadcastPingOk((v) => (v === null ? false : v)), 1200)
        } catch {
          setBroadcastPingOk(false)
        }
      }
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [accessToken, enabled])

  useEffect(() => {
    if (!enabled) return

    const onSound = (e: Event) => {
      try {
        const detail = (e as CustomEvent<SoundDebugEvent>).detail
        if (!detail?.type) return
        setSoundEvents((prev) => [detail, ...prev].slice(0, 6))
      } catch {
      }
    }

    window.addEventListener('systemflow:notificationSound', onSound as any)
    return () => window.removeEventListener('systemflow:notificationSound', onSound as any)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    if (!authReady || !userId || !accessToken) {
      setSysStatus('INIT')
      setChatStatus('INIT')
      return
    }

    try {
      ;(supabase as any).realtime?.setAuth?.(accessToken)
    } catch {}

    setSysEvents(0)
    setChatEvents(0)
    setSysStatus('SUBSCRIBING')
    setChatStatus('SUBSCRIBING')

    const sys = supabase
      .channel(`systemflow_rtdebug_sys_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setSysEvents((n) => n + 1)
      )
      .subscribe((status) => setSysStatus(status as any))

    const chat = supabase
      .channel(`systemflow_rtdebug_chat_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_notifications', filter: `user_id=eq.${userId}` },
        () => setChatEvents((n) => n + 1)
      )
      .subscribe((status) => setChatStatus(status as any))

    return () => {
      void supabase.removeChannel(sys)
      void supabase.removeChannel(chat)
    }
  }, [accessToken, authReady, enabled, userId])

  if (!enabled) return null

  const apiBase = String((import.meta as any).env?.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

  return (
    <div className="fixed bottom-3 right-3 z-[9999] w-[340px] rounded-2xl border border-white/10 bg-black/70 p-3 text-[11px] text-white backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-black tracking-widest uppercase text-white/85">Realtime Debug</div>
        <div className="text-white/55">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="mt-2 space-y-1 text-white/80">
        <div className="flex items-center justify-between">
          <span>authReady</span>
          <span className="text-white/90">{String(authReady)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>userId</span>
          <span className="text-white/90">{userId ? `${userId.slice(0, 8)}…` : 'null'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>accessToken</span>
          <span className="text-white/90">{accessToken ? 'ok' : 'null'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>SUPABASE_URL</span>
          <span className="text-white/90">{SUPABASE_URL}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>channels</span>
          <span className="text-white/90">{channelsCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>socket</span>
          <span className="text-white/90">{socketState}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>sock open</span>
          <span className="text-white/90">{socketLastOpenAt ? new Date(socketLastOpenAt).toLocaleTimeString() : '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>sock close</span>
          <span className="text-white/90">{socketLastCloseAt ? new Date(socketLastCloseAt).toLocaleTimeString() : '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>sock err</span>
          <span className="text-white/90">{socketLastErrorAt ? new Date(socketLastErrorAt).toLocaleTimeString() : '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>close info</span>
          <span className="text-white/90">{socketLastClose ?? '-'}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2">
        <div className="flex items-center justify-between">
          <span>broadcast status</span>
          <span className="text-white/90">{broadcastStatus}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>broadcast ping</span>
          <span className="text-white/90">
            {broadcastPingOk === null ? '...' : broadcastPingOk ? 'ok' : 'falhou'}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="flex items-center justify-between">
            <span>sistema</span>
            <span className="text-white/90">{sysStatus}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>eventos</span>
            <span className="text-white/90">{sysEvents}</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="flex items-center justify-between">
            <span>chat</span>
            <span className="text-white/90">{chatStatus}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>eventos</span>
            <span className="text-white/90">{chatEvents}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
        <div className="flex items-center justify-between">
          <span>sound</span>
          <span className="text-white/90">{soundEvents.length ? `${soundEvents[0].type}:${soundEvents[0].ok ? 'ok' : 'fail'}` : '-'}</span>
        </div>
        {soundEvents.length > 0 && (
          <div className="mt-1 space-y-1 text-white/70">
            {soundEvents.slice(0, 3).map((ev) => (
              <div key={`${ev.at}-${ev.type}`} className="flex items-center justify-between">
                <span>{new Date(ev.at).toLocaleTimeString()} {ev.type}</span>
                <span className="text-white/85">{ev.ok ? 'ok' : ev.error ?? 'fail'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
        <div className="flex items-center justify-between">
          <span>rt test</span>
          <span className="text-white/90">{testResult ?? '-'}</span>
        </div>
        <button
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-50"
          disabled={!accessToken || !apiBase || testRunning}
          onClick={async () => {
            if (!accessToken || !apiBase) return
            setTestRunning(true)
            setTestResult('rodando...')
            const startSys = sysEvents
            const startChat = chatEvents
            try {
              const resp = await fetch(`${apiBase}/debug/realtime-test`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              })
              if (!resp.ok) {
                setTestResult(`api ${resp.status}`)
                setTestRunning(false)
                return
              }
            } catch {
              setTestResult('api falhou')
              setTestRunning(false)
              return
            }

            const deadline = Date.now() + 6000
            const tick = window.setInterval(() => {
              const sysDelta = sysEvents - startSys
              const chatDelta = chatEvents - startChat
              if (sysDelta > 0 || chatDelta > 0) {
                window.clearInterval(tick)
                setTestResult(`ok sys+${sysDelta} chat+${chatDelta}`)
                setTestRunning(false)
                return
              }
              if (Date.now() > deadline) {
                window.clearInterval(tick)
                setTestResult('sem evento')
                setTestRunning(false)
              }
            }, 250)
          }}
        >
          Disparar evento de teste
        </button>
        <div className="mt-1 text-white/55">
          api: {apiBase || 'sem VITE_API_URL'}
        </div>
      </div>
    </div>
  )
}
