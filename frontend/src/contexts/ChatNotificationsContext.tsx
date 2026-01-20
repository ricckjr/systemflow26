import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'

type UnreadByRoomId = Record<string, number>

interface ChatNotificationsContextType {
  unreadByRoomId: UnreadByRoomId
  totalUnread: number
  hasAnyUnread: boolean
  activeRoomId: string | null
  setActiveRoomId: (roomId: string | null) => void
  markRoomAsRead: (roomId: string) => Promise<void>
}

const ChatNotificationsContext = createContext<ChatNotificationsContextType | undefined>(undefined)

function sumUnread(map: UnreadByRoomId) {
  return Object.values(map).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0)
}

export const ChatNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth()

  const [unreadByRoomId, setUnreadByRoomId] = useState<UnreadByRoomId>({})
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const activeRoomIdRef = useRef<string | null>(null)
  const realtimeSubscribedRef = useRef(false)

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    if (!profile?.id) {
      realtimeSubscribedRef.current = false
      setUnreadByRoomId({})
      setActiveRoomId(null)
      return
    }

    let cancelled = false

    const loadUnread = async () => {
      const pageSize = 1000
      let from = 0
      const aggregated: UnreadByRoomId = {}

      while (!cancelled) {
        const { data, error } = await supabase
          .from('chat_notifications')
          .select('room_id')
          .eq('user_id', profile.id)
          .eq('is_read', false)
          .range(from, from + pageSize - 1)

        if (error) break
        const rows = data ?? []

        for (const row of rows as any[]) {
          const roomId = row?.room_id as string | undefined
          if (!roomId) continue
          aggregated[roomId] = (aggregated[roomId] ?? 0) + 1
        }

        if (rows.length < pageSize) break
        from += pageSize
      }

      if (!cancelled) setUnreadByRoomId(aggregated)
    }

    void loadUnread()

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

    const markNotificationRead = async (id: string) => {
      await supabase
        .from('chat_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', profile.id)
    }

    const channel = supabase
      .channel(`chat_notifications_store_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const row = payload.new as any
          const roomId = row?.room_id as string | undefined
          const id = row?.id as string | undefined
          if (!roomId || !id) return

          if (activeRoomIdRef.current && activeRoomIdRef.current === roomId) {
            void markNotificationRead(id)
            return
          }

          adjustRoom(roomId, +1)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const nextRow = payload.new as any
          const prevRow = payload.old as any

          const roomId = (nextRow?.room_id ?? prevRow?.room_id) as string | undefined
          if (!roomId) return

          const wasRead = Boolean(prevRow?.is_read)
          const isRead = Boolean(nextRow?.is_read)
          if (!wasRead && isRead) {
            adjustRoom(roomId, -1)
          }
        }
      )
      .subscribe((status) => {
        realtimeSubscribedRef.current = status === 'SUBSCRIBED'
      })

    const pollMs = 45000
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (realtimeSubscribedRef.current) return
      void loadUnread()
    }, pollMs)

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (realtimeSubscribedRef.current) return
      void loadUnread()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      realtimeSubscribedRef.current = false
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibility)
      channel.unsubscribe()
    }
  }, [profile?.id])

  const totalUnread = useMemo(() => sumUnread(unreadByRoomId), [unreadByRoomId])
  const hasAnyUnread = totalUnread > 0

  const markRoomAsRead = async (roomId: string) => {
    if (!profile?.id) return

    setUnreadByRoomId((prev) => {
      if (!(roomId in prev)) return prev
      const { [roomId]: _removed, ...rest } = prev
      return rest
    })

    await supabase
      .from('chat_notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('room_id', roomId)
      .eq('is_read', false)
  }

  const value = useMemo(
    () => ({
      unreadByRoomId,
      totalUnread,
      hasAnyUnread,
      activeRoomId,
      setActiveRoomId,
      markRoomAsRead,
    }),
    [unreadByRoomId, totalUnread, hasAnyUnread, activeRoomId]
  )

  return <ChatNotificationsContext.Provider value={value}>{children}</ChatNotificationsContext.Provider>
}

export function useChatNotifications() {
  const ctx = useContext(ChatNotificationsContext)
  if (!ctx) throw new Error('useChatNotifications must be used within ChatNotificationsProvider')
  return ctx
}

