import { createContext } from 'react'

export type NotificationChannelKey = 'system' | 'chat'

export type NotificationChannelPreferences = {
  inAppEnabled: boolean
  soundEnabled: boolean
  nativeEnabled: boolean
  pushEnabled: boolean
}

export type NotificationPreferences = {
  system: NotificationChannelPreferences
  chat: NotificationChannelPreferences
  permissionPromptDismissedUntil: string | null
}

export type NotificationPreferencesContextType = {
  preferences: NotificationPreferences
  setChannelPreferences: (channel: NotificationChannelKey, next: Partial<NotificationChannelPreferences>) => Promise<void>
  setPermissionPromptDismissedUntil: (until: string | null) => Promise<void>
  refresh: () => Promise<void>
}

export const NotificationPreferencesContext = createContext<NotificationPreferencesContextType | undefined>(undefined)
