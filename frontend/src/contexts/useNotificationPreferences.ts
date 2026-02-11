import { useContext } from 'react'
import { NotificationPreferencesContext } from '@/contexts/NotificationPreferencesContextCore'

export function useNotificationPreferences() {
  const ctx = useContext(NotificationPreferencesContext)
  if (!ctx) throw new Error('useNotificationPreferences must be used within NotificationPreferencesProvider')
  return ctx
}
