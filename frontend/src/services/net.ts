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
    // Usa endpoint LEVE e rápido
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=none`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'public-anon-check'
      },
      body: '{}',
      signal: controller.signal
    })

    clearTimeout(timeout)

    // Mesmo 401/400 significa que respondeu
    lastStatus = res.ok || res.status === 400 || res.status === 401
    return lastStatus
  } catch {
    lastStatus = false
    return false
  }
}
