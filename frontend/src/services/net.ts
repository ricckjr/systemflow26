/**
 * net.ts
 * Health util LEVE – não bloqueia boot nem reload
 */

let lastStatus: boolean | null = null
let lastCheckAt = 0

const CACHE_MS = 30_000

/**
 * Verifica conectividade real com Supabase
 * ⚠️ NÃO usar no boot / reload
 * ✔️ Usar apenas para UX (badge, aviso, retry)
 */
export async function checkSupabaseReachable(
  supabaseUrl: string
): Promise<boolean> {
  const now = Date.now()

  // Cache simples (UX only)
  if (lastStatus !== null && now - lastCheckAt < CACHE_MS) {
    return lastStatus
  }

  lastCheckAt = now

  // Se navegador offline → falhou
  if (!navigator.onLine) {
    lastStatus = false
    return false
  }

  if (!supabaseUrl) {
    lastStatus = false
    return false
  }

  try {
    // Usa endpoint LEVE e rápido (evita preflight CORS)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    // Mesmo 401 significa que respondeu (servidor acessível)
    lastStatus = res.ok || res.status === 401 || res.status === 403 || res.status === 404
    return lastStatus
  } catch {
    lastStatus = false
    return false
  }
}

let lastApiStatus: boolean | null = null
let lastApiCheckAt = 0

export async function checkApiReachable(apiUrl: string): Promise<boolean> {
  const now = Date.now()

  if (lastApiStatus !== null && now - lastApiCheckAt < CACHE_MS) {
    return lastApiStatus
  }

  lastApiCheckAt = now

  if (!navigator.onLine) {
    lastApiStatus = false
    return false
  }

  const base = String(apiUrl || '').replace(/\/+$/, '')
  if (!base) {
    lastApiStatus = false
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${base}/status`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    lastApiStatus = res.ok || (res.status >= 200 && res.status < 500)
    return lastApiStatus
  } catch {
    lastApiStatus = false
    return false
  }
}
