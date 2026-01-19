import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type UserStatus = 'online' | 'busy' | 'away' | 'offline'

export type UserPresence = {
  status: UserStatus
  statusText?: string
}

type PresenceContextValue = {
  myStatus: UserStatus
  myStatusText: string
  usersPresence: Record<string, UserPresence>
  setStatus: (status: UserStatus) => Promise<void>
  setStatusText: (text: string) => Promise<void>
}

const PresenceContext = createContext<PresenceContextValue | null>(null)

const IDLE_AWAY_MS = 5 * 60 * 1000

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile } = useAuth()
  const userId = profile?.id ?? null

  const [myStatus, setMyStatus] = useState<UserStatus>('online')
  const [myStatusText, setMyStatusText] = useState('')
  const [usersPresence, setUsersPresence] = useState<Record<string, UserPresence>>({})

  const channelRef = useRef<RealtimeChannel | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const myStatusRef = useRef<UserStatus>(myStatus)
  const myStatusTextRef = useRef<string>(myStatusText)

  useEffect(() => {
    myStatusRef.current = myStatus
  }, [myStatus])

  useEffect(() => {
    myStatusTextRef.current = myStatusText
  }, [myStatusText])

  useEffect(() => {
    if (!userId) return
    const key = `systemflow:statusText:${userId}`
    const cached = localStorage.getItem(key)
    if (cached != null) setMyStatusText(cached)
  }, [userId])

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }, [])

  const trackPresence = useCallback(async (status: UserStatus, statusText: string) => {
    const channel = channelRef.current
    if (!channel || !userId) return

    try {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        status,
        status_text: statusText,
      } as any)
    } catch {}

    try {
      await supabase.rpc('update_user_status', { new_status: status })
    } catch {}
  }, [userId])

  const trackStatus = useCallback(async (status: UserStatus) => {
    await trackPresence(status, myStatusTextRef.current)
  }, [trackPresence])

  const setStatus = useCallback(
    async (status: UserStatus) => {
      setMyStatus(status)
      await trackStatus(status)
    },
    [trackStatus]
  )

  const setStatusText = useCallback(
    async (text: string) => {
      const normalized = text.slice(0, 80)
      setMyStatusText(normalized)
      if (userId) localStorage.setItem(`systemflow:statusText:${userId}`, normalized)
      await trackPresence(myStatusRef.current, normalized)
    },
    [trackPresence, userId]
  )

  const resetIdleTimer = useCallback(() => {
    if (!userId) return

    const current = myStatusRef.current
    if (current === 'busy' || current === 'offline') return

    if (current === 'away') {
      setMyStatus('online')
      void trackStatus('online')
    }

    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      const latest = myStatusRef.current
      if (latest === 'online') {
        setMyStatus('away')
        void trackStatus('away')
      }
    }, IDLE_AWAY_MS)
  }, [clearIdleTimer, trackStatus, userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('global_presence', { config: { presence: { key: userId } } })

    const recomputePresence = () => {
      const state = channel.presenceState() as any
      const presenceMap: Record<string, UserPresence> = {}

      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (!p?.user_id) return
          presenceMap[p.user_id] = {
            status: (p.status as UserStatus) || 'online',
            statusText: typeof p.status_text === 'string' ? p.status_text : undefined,
          }
        })
      })

      setUsersPresence(presenceMap)
    }

    channel
      .on('presence', { event: 'sync' }, recomputePresence)
      .on('presence', { event: 'join' }, recomputePresence)
      .on('presence', { event: 'leave' }, recomputePresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        channelRef.current = channel
        await trackPresence(myStatusRef.current, myStatusTextRef.current)
        try {
          await supabase.rpc('mark_all_delivered')
        } catch {}
        resetIdleTimer()
      })

    channelRef.current = channel

    const notificationsChannel = supabase
      .channel(`chat_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as any
          const messageId = row?.message_id as string | undefined
          if (!messageId) return
          try {
            await supabase.rpc('mark_message_delivered', { message_id: messageId })
          } catch {}
        }
      )
      .subscribe()

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ]

    activityEvents.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true } as any))

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetIdleTimer as any))
      clearIdleTimer()
      channel.unsubscribe()
      notificationsChannel.unsubscribe()
      channelRef.current = null
      setUsersPresence({})
    }
  }, [clearIdleTimer, resetIdleTimer, trackPresence, userId])

  const value = useMemo(
    () => ({
      myStatus,
      myStatusText,
      usersPresence,
      setStatus,
      setStatusText,
    }),
    [myStatus, myStatusText, usersPresence, setStatus, setStatusText]
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export const usePresence = () => {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
