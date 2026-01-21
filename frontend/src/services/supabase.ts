import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { logInfo, logWarn } from '@/utils/logger'

/* ------------------------------------------------------------------
 * ENV VALIDATION
 * ------------------------------------------------------------------ */
const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !rawAnonKey) {
  throw new Error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const supabaseUrl = rawUrl.trim().replace(/\/+$/, '')
const supabaseAnonKey = rawAnonKey.trim()
const SUPABASE_AUTH_STORAGE_KEY = 'systemflow-auth-token'

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
      fetch: (...args) => fetch(...args),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'systemflow-auth-token',
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

/* ------------------------------------------------------------------
 * LOGGING (DEV ONLY)
 * ------------------------------------------------------------------ */
if (import.meta.env.DEV) {
  try {
    const maskedKey = `${supabaseAnonKey.slice(0, 6)}...`
    logInfo('supabase', 'client initialized', {
      url: supabaseUrl,
      anonKey: maskedKey,
    })
  } catch {
    logWarn('supabase', 'failed to log initialization')
  }
}
