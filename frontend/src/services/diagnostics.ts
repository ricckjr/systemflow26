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

export const checkTableAccess = async (table: string) => {
  try {
    const res: any = await withTiming('diagnostics', `count ${table}`, async () => {
      return supabase
        .from(table)
        .select('id_oportunidade', { count: 'exact' })
        .limit(1)
    })
    if (res?.error) {
      logError('diagnostics', `rls error on ${table}`, res.error)
      return { ok: false, error: res.error }
    }
    logInfo('diagnostics', `rls ok on ${table}`, { count: res?.count ?? null })
    return { ok: true, count: res?.count ?? null }
  } catch (error: any) {
    logError('diagnostics', `count failed on ${table}`, error)
    return { ok: false, error }
  }
}
