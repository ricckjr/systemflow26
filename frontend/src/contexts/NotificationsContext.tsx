import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotificationPreferences } from '@/contexts/NotificationPreferencesContext'
import { setRealtimeAuth } from '@/services/realtime'
import { playSystemAlertSound } from '@/utils/notificationSound'
import { showBrowserNotification } from '@/utils/browserNotifications'
import { chatService } from '@/services/chat'
import type { Notification } from '@/types'
import { useToast, openToastUrl } from '@/contexts/ToastContext'
import { logWarn } from '@/utils/logger'

type UnreadByRoomId = Record<string, number>

type NotificationsContextType = {
  notifications: Array<Notification & { metadata?: any | null }>
  unreadCount: number
  unreadByRoomId: UnreadByRoomId
  hasAnyChatUnread: boolean
  activeChatRoomId: string | null
  setActiveChatRoomId: (roomId: string | null) => void
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  markChatRoomAsRead: (roomId: string) => Promise<void>
  refresh: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

function safeRoomIdFromMetadata(metadata: any): string | null {
  const roomId = metadata?.room_id
  return typeof roomId === 'string' && roomId ? roomId : null
}

function safeMessageIdFromMetadata(metadata: any): string | null {
  const messageId = metadata?.message_id
  return typeof messageId === 'string' && messageId ? messageId : null
}

function isChatNotification(n: { type?: string }) {
  return String(n?.type || '').toLowerCase() === 'chat'
}

function shouldCountInBadge(input: {
  notification: { type?: string; is_read?: boolean }
  chatEnabled: boolean
  systemEnabled: boolean
}) {
  if (input.notification?.is_read) return false
  return isChatNotification(input.notification) ? input.chatEnabled : input.systemEnabled
}

function emitNotificationsRealtimeDebug(detail: { status?: string; event?: 'INSERT'; type?: string; id?: string; at: number }) {
  try {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('systemflow:notificationsRealtime', { detail }))
  } catch {}
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, authReady } = useAuth()
  const userId = session?.user?.id ?? null
  const accessToken = session?.access_token ?? null
  const { pushToast } = useToast()

  const { preferences } = useNotificationPreferences()
  const chatInAppEnabled = preferences.chat.inAppEnabled
  const systemInAppEnabled = preferences.system.inAppEnabled
  const chatSoundEnabled = preferences.chat.soundEnabled
  const systemSoundEnabled = preferences.system.soundEnabled
  const chatNativeEnabled = preferences.chat.nativeEnabled
  const systemNativeEnabled = preferences.system.nativeEnabled

  const [notifications, setNotifications] = useState<Array<Notification & { metadata?: any | null }>>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadByRoomId, setUnreadByRoomId] = useState<UnreadByRoomId>({})

  const [activeChatRoomId, setActiveChatRoomId] = useState<string | null>(null)
  const activeChatRoomIdRef = useRef<string | null>(null)
  const lastSoundAtRef = useRef<number>(0)

  const realtimeSubscribedRef = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    activeChatRoomIdRef.current = activeChatRoomId
  }, [activeChatRoomId])

  const recomputeUnreadCount = useCallback(
    (rows: Array<Notification & { metadata?: any | null }>) => {
      const count = rows.reduce((acc, n) => {
        return acc + (shouldCountInBadge({ notification: n, chatEnabled: chatInAppEnabled, systemEnabled: systemInAppEnabled }) ? 1 : 0)
      }, 0)
      setUnreadCount(count)
    },
    [chatInAppEnabled, systemInAppEnabled]
  )

  const refresh = useCallback(async () => {
    if (!authReady || !userId) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) return

      const rows = (data ?? []) as Array<Notification & { metadata?: any | null }>
      setNotifications(rows)
      recomputeUnreadCount(rows)
    } catch (error) {
      logWarn('notifications', 'refresh failed', error)
    }
  }, [authReady, recomputeUnreadCount, userId])

  const refreshChatUnreadByRoom = useCallback(async () => {
    if (!authReady || !userId) return
    const aggregated: UnreadByRoomId = {}
    const pageSize = 1000
    let from = 0
    try {
      while (true) {
        const { data, error } = await supabase
          .from('notifications')
          .select('metadata')
          .eq('user_id', userId)
          .eq('type', 'chat')
          .eq('is_read', false)
          .range(from, from + pageSize - 1)

        if (error) break
        const rows = (data ?? []) as any[]

        for (const row of rows) {
          const roomId = safeRoomIdFromMetadata(row?.metadata)
          if (!roomId) continue
          aggregated[roomId] = (aggregated[roomId] ?? 0) + 1
        }

        if (rows.length < pageSize) break
        from += pageSize
      }

      setUnreadByRoomId(aggregated)
    } catch (error) {
      logWarn('notifications', 'refresh chat unread failed', error)
    }
  }, [authReady, userId])

  const markRowReadOptimistic = useCallback(
    (notificationId: string) => {
      setNotifications((prev) => {
        let changed = false
        const next = prev.map((n) => {
          if (n.id !== notificationId) return n
          if (n.is_read) return n
          changed = true
          return { ...n, is_read: true }
        })
        if (changed) recomputeUnreadCount(next)
        return next
      })
    },
    [recomputeUnreadCount]
  )

  const markNotificationReadInDb = useCallback(
    async (notificationId: string) => {
      if (!userId) return
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', userId)
      } catch {}
    },
    [userId]
  )

  useEffect(() => {
    if (!authReady || !userId || !accessToken) {
      realtimeSubscribedRef.current = false
      setNotifications([])
      setUnreadCount(0)
      setUnreadByRoomId({})
      setActiveChatRoomId(null)
      return
    }

    let disposed = false
    let retryCount = 0

    const clearRetry = () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }

    const scheduleRetry = () => {
      if (disposed) return
      clearRetry()
      retryCount += 1
      const delay = Math.min(30000, 800 * Math.pow(2, Math.min(6, retryCount)))
      retryTimeoutRef.current = window.setTimeout(() => {
        if (disposed) return
        subscribeNow()
      }, delay)
    }

    const adjustRoom = (roomId: string, delta: number) => {
      setUnreadByRoomId((prev) => {
        const current = prev[roomId] ?? 0
        const next = Math.max(0, current + delta)
        if (next === 0) {
          const { [roomId]: _removed, ...rest } = prev
          return rest
        }
        if (next === current) return prev
        return { ...prev, [roomId]: next }
      })
    }

    const subscribeNow = () => {
      if (disposed) return
      clearRetry()
      realtimeSubscribedRef.current = false

      setRealtimeAuth(supabase, accessToken)
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const channel = supabase
        .channel(`notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            const next = payload.new as any
            if (!next?.id) return
            emitNotificationsRealtimeDebug({ event: 'INSERT', type: next?.type, id: next.id, at: Date.now() })

            const metadata = next?.metadata ?? null
            const roomId = isChatNotification(next) ? safeRoomIdFromMetadata(metadata) : null

            if (roomId && activeChatRoomIdRef.current === roomId) {
              markRowReadOptimistic(next.id)
              void markNotificationReadInDb(next.id)
              return
            }

            setNotifications((prev) => {
              const filtered = prev.filter((n) => n.id !== next.id)
              const merged = [next, ...filtered].slice(0, 30)
              recomputeUnreadCount(merged)
              return merged
            })

            if (roomId && !Boolean(next.is_read) && chatInAppEnabled) {
              adjustRoom(roomId, +1)
            }

            const isVisible = document.visibilityState === 'visible'
            const isFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true
            const inFocus = isVisible && isFocused

            if (!Boolean(next.is_read)) {
              const soundEnabled = isChatNotification(next) ? chatSoundEnabled : systemSoundEnabled
              if (soundEnabled) {
                const now = Date.now()
                if (now - (lastSoundAtRef.current || 0) > 900) {
                  lastSoundAtRef.current = now
                  void playSystemAlertSound()
                }
              }
            }

            if (!Boolean(next.is_read) && isVisible) {
              const inAppEnabled = isChatNotification(next) ? chatInAppEnabled : systemInAppEnabled
              if (inAppEnabled) {
                const title = isChatNotification(next) ? '💬 Nova mensagem' : `🔔 ${next.title || 'Alerta do sistema'}`
                const message = isChatNotification(next) ? (next.content ?? '') : (next.content ?? '')
                pushToast({
                  kind: isChatNotification(next) ? 'chat' : 'system',
                  title,
                  message: message || undefined,
                  durationMs: 5200,
                  onClick: () => {
                    markRowReadOptimistic(next.id)
                    void markNotificationReadInDb(next.id)
                    if (typeof next.link === 'string' && next.link) openToastUrl(next.link)
                  },
                })
              }
            }

            if (!Boolean(next.is_read) && !isVisible) {
              const nativeEnabled = isChatNotification(next) ? chatNativeEnabled : systemNativeEnabled
              if (nativeEnabled) {
                showBrowserNotification({
                  title: next.title || (isChatNotification(next) ? 'Nova mensagem' : 'Notificação'),
                  body: next.content ?? undefined,
                  url: next.link ?? undefined,
                  tag: `${isChatNotification(next) ? 'chat' : 'system'}:${next.id}`,
                })
              }
            }

            if (isChatNotification(next)) {
              const messageId = safeMessageIdFromMetadata(metadata)
              if (messageId) {
                try {
                  await chatService.markMessageDelivered(messageId)
                } catch {}
              }
            }
          }
        )
        .subscribe((status) => {
          if (disposed) return
          realtimeSubscribedRef.current = status === 'SUBSCRIBED'
          emitNotificationsRealtimeDebug({ status, at: Date.now() })
          if (status === 'SUBSCRIBED') {
            retryCount = 0
            void refresh()
            void refreshChatUnreadByRoom()
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleRetry()
          }
        })

      channelRef.current = channel
    }

    void refresh()
    void refreshChatUnreadByRoom()
    subscribeNow()

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      void refresh()
      void refreshChatUnreadByRoom()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      realtimeSubscribedRef.current = false
      clearRetry()
      document.removeEventListener('visibilitychange', onVisibility)
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [
    accessToken,
    authReady,
    chatInAppEnabled,
    chatNativeEnabled,
    chatSoundEnabled,
    markNotificationReadInDb,
    markRowReadOptimistic,
    pushToast,
    refresh,
    refreshChatUnreadByRoom,
    systemInAppEnabled,
    systemNativeEnabled,
    systemSoundEnabled,
    userId,
    recomputeUnreadCount,
  ])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!authReady || !userId) return
      markRowReadOptimistic(notificationId)
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', userId)
    },
    [authReady, markRowReadOptimistic, userId]
  )

  const markAllAsRead = useCallback(async () => {
    if (!authReady || !userId) return

    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, is_read: true }))
      setUnreadCount(0)
      return next
    })
    setUnreadByRoomId({})

    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }, [authReady, userId])

  const markChatRoomAsRead = useCallback(
    async (roomId: string) => {
      if (!authReady || !userId) return
      if (!roomId) return

      setUnreadByRoomId((prev) => {
        if (!(roomId in prev)) return prev
        const { [roomId]: _removed, ...rest } = prev
        return rest
      })

      setNotifications((prev) => {
        const next = prev.map((n) => {
          if (!isChatNotification(n) || n.is_read) return n
          const meta = (n as any)?.metadata
          const candidateRoom = safeRoomIdFromMetadata(meta)
          if (candidateRoom !== roomId) return n
          return { ...n, is_read: true }
        })
        recomputeUnreadCount(next)
        return next
      })

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('type', 'chat')
        .eq('is_read', false)
        .contains('metadata', { room_id: roomId } as any)
    },
    [authReady, recomputeUnreadCount, userId]
  )

  const hasAnyChatUnread = useMemo(() => {
    if (!chatInAppEnabled) return false
    return Object.values(unreadByRoomId).some((n) => (Number.isFinite(n) ? n > 0 : false))
  }, [chatInAppEnabled, unreadByRoomId])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadByRoomId: chatInAppEnabled ? unreadByRoomId : {},
      hasAnyChatUnread,
      activeChatRoomId,
      setActiveChatRoomId,
      markAsRead,
      markAllAsRead,
      markChatRoomAsRead,
      refresh,
    }),
    [
      activeChatRoomId,
      chatInAppEnabled,
      hasAnyChatUnread,
      markAllAsRead,
      markAsRead,
      markChatRoomAsRead,
      notifications,
      refresh,
      unreadByRoomId,
      unreadCount,
    ]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
