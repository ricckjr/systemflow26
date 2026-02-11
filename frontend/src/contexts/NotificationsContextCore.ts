import { createContext } from 'react'
import type { Notification } from '@/types'

type UnreadByRoomId = Record<string, number>

export type NotificationsContextType = {
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

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)
