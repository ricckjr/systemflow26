import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Notification } from '@/types'
import { playSystemAlertSound } from '@/utils/notificationSound'
import { useNotificationPreferences } from '@/contexts/NotificationPreferencesContext'
import { showBrowserNotification } from '@/utils/browserNotifications'

interface SystemNotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refresh: () => Promise<void>
}

const SystemNotificationsContext = createContext<SystemNotificationsContextType | undefined>(undefined)

function countUnread(rows: Notification[]) {
  return rows.reduce((acc, n) => acc + (n?.is_read ? 0 : 1), 0)
}

export const SystemNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, authReady } = useAuth()
  const userId = session?.user?.id ?? null
  const accessToken = session?.access_token ?? null
  const { preferences } = useNotificationPreferences()
  const inAppEnabled = preferences.system.inAppEnabled
  const soundEnabled = preferences.system.soundEnabled
  const nativeEnabled = preferences.system.nativeEnabled

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const realtimeSubscribedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!authReady || !userId) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return

    const rows = (data ?? []) as Notification[]
    setNotifications(rows)
    setUnreadCount(inAppEnabled ? countUnread(rows) : 0)
  }, [authReady, inAppEnabled, userId])

  useEffect(() => {
    if (!authReady || !userId || !accessToken) {
      realtimeSubscribedRef.current = false
      setNotifications([])
      setUnreadCount(0)
      return
    }

    void refresh()

    try {
      ;(supabase as any).realtime?.setAuth?.(accessToken)
    } catch {
    }

    const channel = supabase
      .channel(`system_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Notification
          if (!next?.id) return

          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== next.id)
            return [next, ...filtered].slice(0, 20)
          })
          if (!next.is_read && inAppEnabled) setUnreadCount((c) => c + 1)
          if (!next.is_read && soundEnabled) void playSystemAlertSound()
          if (!next.is_read && nativeEnabled && document.visibilityState !== 'visible') {
            showBrowserNotification({
              title: next.title || 'Notificação',
              body: next.content ?? undefined,
              url: next.link ?? undefined,
              tag: `system:${next.id}`,
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as Notification
          if (!next?.id) return

          setNotifications((prev) => {
            const idx = prev.findIndex((n) => n.id === next.id)
            if (idx < 0) return prev

            const prevItem = prev[idx]
            if (Boolean(prevItem.is_read) !== Boolean(next.is_read)) {
              if (inAppEnabled) {
                setUnreadCount((c) => Math.max(0, c + (next.is_read ? -1 : 1)))
              }
            }

            const copy = [...prev]
            copy[idx] = { ...prevItem, ...next }
            return copy
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRow = payload.old as Partial<Notification>
          const id = oldRow?.id
          if (!id) return

          setNotifications((prev) => {
            const existing = prev.find((n) => n.id === id)
            if (inAppEnabled && existing && !existing.is_read) setUnreadCount((c) => Math.max(0, c - 1))
            return prev.filter((n) => n.id !== id)
          })
        }
      )
      .subscribe((status) => {
        realtimeSubscribedRef.current = status === 'SUBSCRIBED'
        if (status === 'SUBSCRIBED') void refresh()
      })

    const pollMs = 25000
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (realtimeSubscribedRef.current) return
      void refresh()
    }, pollMs)

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (realtimeSubscribedRef.current) return
      void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      realtimeSubscribedRef.current = false
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibility)
      channel.unsubscribe()
    }
  }, [accessToken, authReady, inAppEnabled, nativeEnabled, refresh, soundEnabled, userId])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!authReady || !userId) return

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)

      setNotifications((prev) => {
        let changed = false
        const next = prev.map((n) => {
          if (n.id !== notificationId) return n
          if (n.is_read) return n
          changed = true
          return { ...n, is_read: true }
        })
      if (changed && inAppEnabled) setUnreadCount((c) => Math.max(0, c - 1))
        return next
      })
    },
    [authReady, inAppEnabled, userId]
  )

  const markAllAsRead = useCallback(async () => {
    if (!authReady || !userId) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [authReady, userId])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      refresh,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead, refresh]
  )

  return <SystemNotificationsContext.Provider value={value}>{children}</SystemNotificationsContext.Provider>
}

export function useSystemNotifications() {
  const ctx = useContext(SystemNotificationsContext)
  if (!ctx) throw new Error('useSystemNotifications must be used within SystemNotificationsProvider')
  return ctx
}
