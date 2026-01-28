import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { logInfo, logWarn } from '@/utils/logger'
import { setupRealtimeAutoRecover } from '@/services/realtime'

/* ------------------------------------------------------------------
 * ENV VALIDATION
 * ------------------------------------------------------------------ */
const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !rawAnonKey) {
  throw new Error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const supabaseRemoteUrl = rawUrl.trim().replace(/\/+$/, '')
const supabaseAnonKey = rawAnonKey.trim()
const SUPABASE_AUTH_STORAGE_KEY = 'systemflow-auth-token'
const useDevProxy =
  import.meta.env.DEV &&
  String(import.meta.env.VITE_SUPABASE_DEV_PROXY || '0') === '1' &&
  typeof window !== 'undefined' &&
  !!window.location?.origin

const supabaseUrl = useDevProxy ? window.location.origin : supabaseRemoteUrl

function clearSupabaseAuthStorage() {
  try {
    localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY)
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })
  } catch {
  }
}

try {
  const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    const candidate = parsed?.currentSession ?? parsed?.session ?? parsed
    const refreshToken = candidate?.refresh_token
    if (!refreshToken || typeof refreshToken !== 'string') {
      clearSupabaseAuthStorage()
    }
  }
} catch {
  clearSupabaseAuthStorage()
}

/* ------------------------------------------------------------------
 * GLOBAL SINGLETON (HMR SAFE)
 * ------------------------------------------------------------------ */
declare global {
  // eslint-disable-next-line no-var
  var __systemflow_supabase: SupabaseClient<Database> | undefined
}

/* ------------------------------------------------------------------
 * CLIENT FACTORY
 * ------------------------------------------------------------------ */
function createSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          return await fetch(input, init)
        } catch (err) {
          try {
            if (
              useDevProxy &&
              supabaseRemoteUrl &&
              supabaseRemoteUrl !== supabaseUrl &&
              typeof window !== 'undefined' &&
              !(window as any).__systemflow_unloading
            ) {
              const raw =
                typeof input === 'string'
                  ? input
                  : input instanceof URL
                    ? input.toString()
                    : (input as Request).url
              if (raw && raw.startsWith(supabaseUrl)) {
                const fallbackUrl = `${supabaseRemoteUrl}${raw.slice(supabaseUrl.length)}`
                return await fetch(fallbackUrl, init)
              }
            }
          } catch {
          }
          try {
            if (typeof window !== 'undefined' && (window as any).__systemflow_unloading) {
              return new Promise<Response>(() => {})
            }
          } catch {
          }
          throw err
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      storage: localStorage,
    },
  })
}

/* ------------------------------------------------------------------
 * SINGLETON INSTANCE
 * ------------------------------------------------------------------ */
export const supabase: SupabaseClient<Database> =
  globalThis.__systemflow_supabase ?? createSupabaseClient()

if (import.meta.env.DEV) {
  globalThis.__systemflow_supabase = supabase
}

/* ------------------------------------------------------------------
 * CONSTANTS
 * ------------------------------------------------------------------ */
export const SUPABASE_URL = supabaseUrl

try {
  if (typeof window !== 'undefined') {
    ;(window as any).__systemflow_unloading = false
    try {
      if ((import.meta as any).hot) {
        ;(import.meta as any).hot.on('vite:beforeFullReload', () => {
          ;(window as any).__systemflow_unloading = true
        })
      }
    } catch {
    }
    window.addEventListener('beforeunload', () => {
      ;(window as any).__systemflow_unloading = true
    })
    window.addEventListener('pagehide', () => {
      ;(window as any).__systemflow_unloading = true
    })
    try {
      setupRealtimeAutoRecover(supabase)
    } catch {
    }
  }
} catch {
}

/* ------------------------------------------------------------------
 * LOGGING (DEV ONLY)
 * ------------------------------------------------------------------ */
if (import.meta.env.DEV) {
  try {
    const maskedKey = `${supabaseAnonKey.slice(0, 6)}...`
    logInfo('supabase', 'client initialized', {
      url: supabaseUrl,
      anonKey: maskedKey,
      devProxy: useDevProxy,
    })
  } catch {
    logWarn('supabase', 'failed to log initialization')
  }
}
