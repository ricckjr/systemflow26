export function canShowBrowserNotification() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
}

export function showBrowserNotification(input: {
  title: string
  body?: string
  url?: string
  tag?: string
  icon?: string
}) {
  if (!canShowBrowserNotification()) return null

  try {
    const notification = new Notification(input.title, {
      body: input.body,
      tag: input.tag,
      icon: input.icon,
    })

    if (input.url) {
      notification.onclick = () => {
        try {
          window.focus()
        } catch {}
        try {
          window.location.assign(input.url!)
        } catch {}
      }
    }

    return notification
  } catch {
    return null
  }
}

