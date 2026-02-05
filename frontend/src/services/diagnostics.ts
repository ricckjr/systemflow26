import { supabase, SUPABASE_URL } from '@/services/supabase'
import { logInfo, logWarn, logError, withTiming } from '@/utils/logger'
import { checkSupabaseReachable } from './net'

export const checkSupabaseConnectivity = async () => {
  const online = await checkSupabaseReachable(SUPABASE_URL)
  logInfo('diagnostics', `connectivity ${online ? 'online' : 'offline'}`, { url: SUPABASE_URL })
  const session = await supabase.auth.getSession()
  const uid = session?.data?.session?.user?.id || null
  logInfo('diagnostics', `session ${uid ? 'present' : 'absent'}`, { userId: uid })
  return { online, userId: uid }
}

function classifySupabaseError(err: any): 'network' | 'auth' | 'schema' | 'rls' | 'unknown' {
  if (!err) return 'unknown'

  const name = String(err?.name || '')
  const message = String(err?.message || err?.details || '')
  const code = String(err?.code || '')
  const status = Number(err?.status || 0)

  if (name === 'AbortError' || message.toLowerCase().includes('aborted')) return 'network'
  if (name === 'TypeError' || message.includes('Failed to fetch')) return 'network'
  if (status === 401 || status === 403) return 'auth'
  if (code === '42P01' || message.toLowerCase().includes('does not exist')) return 'schema'

  return 'rls'
}

export const checkTableAccess = async (table: string) => {
  try {
    const res: any = await withTiming('diagnostics', `count ${table}`, async () => {
      return (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1)
    })
    if (res?.error) {
      const kind = classifySupabaseError(res.error)
      const msg =
        kind === 'network'
          ? `network error on ${table}`
          : kind === 'auth'
            ? `auth error on ${table}`
            : kind === 'schema'
              ? `schema error on ${table}`
              : kind === 'rls'
                ? `rls/policy error on ${table}`
                : `error on ${table}`

      if (kind === 'network') logWarn('diagnostics', msg, res.error)
      else logError('diagnostics', msg, res.error)

      return { ok: false, kind, error: res.error }
    }
    logInfo('diagnostics', `table ok on ${table}`, { count: res?.count ?? null })
    return { ok: true, count: res?.count ?? null }
  } catch (error: any) {
    const kind = classifySupabaseError(error)
    const msg = kind === 'network' ? `network failed on ${table}` : `count failed on ${table}`
    if (kind === 'network') logWarn('diagnostics', msg, error)
    else logError('diagnostics', msg, error)
    return { ok: false, kind, error }
  }
}
