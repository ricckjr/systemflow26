import { createContext } from 'react'

export type UserStatus = 'online' | 'busy' | 'away' | 'offline'

export type UserPresence = {
  status: UserStatus
  statusText?: string
}

export type PresenceContextValue = {
  myStatus: UserStatus
  myStatusText: string
  usersPresence: Record<string, UserPresence>
  setStatus: (status: UserStatus) => Promise<void>
  setStatusText: (text: string) => Promise<void>
}

export const PresenceContext = createContext<PresenceContextValue | null>(null)
