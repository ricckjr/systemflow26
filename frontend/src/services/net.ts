const TIMEOUT_MS = 5000
let lastCheck = 0
let lastOk = false

export const pingSupabase = async (url: string) => {
  const now = Date.now()
  if (now - lastCheck < 15000) return lastOk
  lastCheck = now
  try {
    if (!url) {
      lastOk = navigator.onLine
      return lastOk
    }
    let host = ''
    try { host = new URL(url).host } catch {}
    const isSupabaseHost = host.includes('supabase.co')
    if (!isSupabaseHost) {
      lastOk = navigator.onLine
      return lastOk
    }
    const timeout = new Promise<{ __timeout: true }>(resolve => setTimeout(() => resolve({ __timeout: true }), TIMEOUT_MS))
    const req = fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    const winner = await Promise.race([req, timeout]) as any
    if (winner?.__timeout) {
      lastOk = navigator.onLine
      return lastOk
    }
    lastOk = true
    return true
  } catch {
    lastOk = navigator.onLine
    return lastOk
  }
}
