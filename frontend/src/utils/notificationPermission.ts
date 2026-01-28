const DISMISSED_UNTIL_KEY = 'systemflow:notificationPermissionPrompt:dismissedUntil'
const DEFAULT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission(): NotificationPermission | null {
  if (!canUseBrowserNotifications()) return null
  return Notification.permission
}

export function getNotificationPromptDismissedUntil(): number | null {
  try {
    const raw = localStorage.getItem(DISMISSED_UNTIL_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export function dismissNotificationPromptForCooldown(cooldownMs = DEFAULT_COOLDOWN_MS) {
  const until = Date.now() + cooldownMs
  try {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(until))
  } catch {}
  return until
}

export function shouldShowNotificationPermissionPrompt() {
  const permission = getBrowserNotificationPermission()
  if (permission !== 'default') return false

  const until = getNotificationPromptDismissedUntil()
  if (!until) return true
  return Date.now() >= until
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | null> {
  const permission = getBrowserNotificationPermission()
  if (!permission) return null

  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    try {
      const result = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission(resolve)
      })
      return result
    } catch {
      return getBrowserNotificationPermission()
    }
  }
}

