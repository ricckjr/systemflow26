import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, SUPABASE_URL } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'

type ChannelStatus = 'INIT' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'

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
    if (!import.meta.env.DEV) return false
    const qs = new URLSearchParams(location.search)
    return parseBool(qs.get('rtdebug'))
  }, [location.search])

  const [socketState, setSocketState] = useState<string>('unknown')
  const [broadcastStatus, setBroadcastStatus] = useState<ChannelStatus>('INIT')
  const [broadcastPingOk, setBroadcastPingOk] = useState<boolean | null>(null)

  const [sysStatus, setSysStatus] = useState<ChannelStatus>('INIT')
  const [sysEvents, setSysEvents] = useState(0)

  const [chatStatus, setChatStatus] = useState<ChannelStatus>('INIT')
  const [chatEvents, setChatEvents] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let alive = true
    const tick = window.setInterval(() => {
      if (!alive) return
      try {
        const sock = (supabase as any).realtime?.socket
        const state = sock?.connectionState?.() ?? sock?.conn?.readyState ?? sock?.state ?? 'unknown'
        setSocketState(String(state))
      } catch {
        setSocketState('unknown')
      }
    }, 800)

    return () => {
      alive = false
      window.clearInterval(tick)
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
      channel.unsubscribe()
    }
  }, [accessToken, enabled])

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
      sys.unsubscribe()
      chat.unsubscribe()
    }
  }, [accessToken, authReady, enabled, userId])

  if (!enabled) return null

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
          <span>socket</span>
          <span className="text-white/90">{socketState}</span>
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
    </div>
  )
}

