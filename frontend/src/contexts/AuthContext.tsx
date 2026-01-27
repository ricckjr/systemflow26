import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import type { Profile, ProfilePermissao } from '@/types'

function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs: number) {
  const promise = Promise.resolve(promiseLike)
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  }) as Promise<T>
}

/* ================================
   Types
================================ */
interface AuthContextType {
  session: Session | null
  profile: Profile | null
  permissions: ProfilePermissao[] | null

  authReady: boolean
  profileReady: boolean

  refreshProfile: () => Promise<void>
  loadPermissions: () => Promise<void>
  signOut: () => Promise<void>

  isAdmin: boolean
}

/* ================================
   Context
================================ */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/* ================================
   Cache Keys
================================ */
const PROFILE_CACHE_KEY = 'systemflow:profile'
const PERMS_CACHE_KEY   = 'systemflow:permissions'
const AUTH_STORAGE_KEY  = 'systemflow-auth-token'

declare global {
  var __systemflow_auth_sub: { unsubscribe: () => void } | undefined
}

/* ================================
   Helpers
================================ */
function safeParse<T>(v: string | null): T | null {
  try {
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}

function normalizeProfile(p: any): Profile | null {
  if (!p) return null

  if (p.role && !p.cargo) {
    const map: Record<string, string> = {
      admin: 'ADMIN',
      user: 'VENDEDOR'
    }
    p.cargo = map[p.role.toLowerCase()] ?? 'VENDEDOR'
  }

  return p as Profile
}

function isInvalidRefreshTokenError(err: unknown) {
  const message =
    typeof err === 'object' && err && 'message' in err
      ? String((err as any).message)
      : String(err)

  const m = message.toLowerCase()
  return (
    m.includes('invalid refresh token') ||
    m.includes('refresh token not found') ||
    m.includes('invalid_grant')
  )
}

/* ================================
   Provider
================================ */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mounted = useRef(true)
  const sessionRef = useRef<Session | null>(null)

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<ProfilePermissao[] | null>(null)

  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

  const clearAuthStorageAndState = useCallback((setReady: boolean) => {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(PERMS_CACHE_KEY)
    localStorage.removeItem(AUTH_STORAGE_KEY)

    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })

    setSession(null)
    sessionRef.current = null
    setProfile(null)
    setPermissions(null)
    if (setReady) setAuthReady(true)
    setProfileReady(true)
  }, [])

  /* ================================
    Init (BOOT)
  ================================ */
  useEffect(() => {
    mounted.current = true

    // Cache rápido (não define ready)
    const cachedProfile = normalizeProfile(
      safeParse<Profile>(localStorage.getItem(PROFILE_CACHE_KEY))
    )
    if (cachedProfile) setProfile(cachedProfile)

    // Session
    withTimeout(supabase.auth.getSession(), 8000)
      .then(({ data, error }) => {
        if (!mounted.current) return

        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            clearAuthStorageAndState(true)
            supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            return
          }
          throw error
        }

        const currentSession = data.session ?? null
        setSession(currentSession)
        sessionRef.current = currentSession
        setAuthReady(true)

        if (currentSession) {
          refreshProfile(currentSession)
        } else {
          setProfileReady(true)
        }
      })
      .catch(err => {
        if (!mounted.current) return
        console.error('[AUTH] getSession failed', err)
        clearAuthStorageAndState(true)
      })

    globalThis.__systemflow_auth_sub?.unsubscribe()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, newSession) => {
        if (!mounted.current) return

        const prevSession = sessionRef.current
        const prevUserId = prevSession?.user?.id
        const nextUserId = newSession?.user?.id
        const sessionIdentityChanged = prevUserId !== nextUserId

        if (!newSession && prevSession) {
          withTimeout(supabase.auth.getSession(), 2000)
            .then(({ data, error }) => {
              if (!mounted.current) return
              if (error) {
                if (isInvalidRefreshTokenError(error)) {
                  clearAuthStorageAndState(true)
                  supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                  return
                }
                throw error
              }
              const verifiedSession = data.session ?? null
              if (verifiedSession) {
                setSession(verifiedSession)
                sessionRef.current = verifiedSession
                return
              }

              clearAuthStorageAndState(false)
            })
            .catch(() => {
              if (!mounted.current) return
              clearAuthStorageAndState(false)
            })

          return
        }

        setSession(newSession)
        sessionRef.current = newSession

        if (sessionIdentityChanged) {
          setProfileReady(false)

          if (newSession) {
            refreshProfile(newSession)
          } else {
            setProfile(null)
            setPermissions(null)
            setProfileReady(true)
            localStorage.removeItem(PROFILE_CACHE_KEY)
            localStorage.removeItem(PERMS_CACHE_KEY)
          }
        }
      }
    )

    globalThis.__systemflow_auth_sub = subscription

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        if (globalThis.__systemflow_auth_sub === subscription) {
          globalThis.__systemflow_auth_sub = undefined
        }
        subscription.unsubscribe()
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInvalidRefreshTokenError(event.reason)) {
        event.preventDefault()
        clearAuthStorageAndState(true)
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      mounted.current = false
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      if (globalThis.__systemflow_auth_sub === subscription) {
        globalThis.__systemflow_auth_sub = undefined
      }
      subscription.unsubscribe()
    }
  }, [])

  /* ================================
     Profile
  ================================ */
  const refreshProfile = useCallback(async (sessionOverride?: Session | null) => {
    const activeSession = sessionOverride ?? session
    if (!activeSession) {
      setProfileReady(true)
      return
    }

    try {
      const { data, error } = await withTimeout(supabase
        .from('profiles')
        .select('id, nome, email_login, email_corporativo, telefone, ramal, ativo, avatar_url, cargo')
        .eq('id', activeSession.user.id)
        .maybeSingle(), 8000)

      if (error) throw error

      const normalized = normalizeProfile(data)
      setProfile(normalized)

      if (normalized) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(normalized))
      }
    } catch (err) {
      console.error('[AUTH] profile load failed', err)
      setProfile(null)
    } finally {
      if (mounted.current) setProfileReady(true) // 🔥 NUNCA trava
    }
  }, [session])

  /* ================================
     Permissions (lazy)
  ================================ */
  const loadPermissions = useCallback(async () => {
    if (!session) return

    const cached = safeParse<ProfilePermissao[]>(
      localStorage.getItem(PERMS_CACHE_KEY)
    )
    if (cached) setPermissions(cached)

    const { data } = await withTimeout(supabase
      .from('profile_permissoes')
      .select('*, permissoes(*)')
      .eq('profile_id', session.user.id), 8000)

    if (!mounted.current) return

    if (data) {
      setPermissions(data)
      localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(data))
    }
  }, [session])

  /* ================================
     SignOut
  ================================ */
  const signingOutRef = useRef(false)

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return
    signingOutRef.current = true

    try {
      sessionStorage.setItem('systemflow:manual-logout', '1')
    } catch {
    }

    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(PERMS_CACHE_KEY)
    localStorage.removeItem(AUTH_STORAGE_KEY)

    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })

    setSession(null)
    sessionRef.current = null
    setProfile(null)
    setPermissions(null)
    setAuthReady(true)
    setProfileReady(true)

    try {
      await withTimeout(
        supabase.rpc('update_user_status', { new_status: 'offline' }),
        4000
      )
    } catch {
    }

    try {
      const { error } = await withTimeout(supabase.auth.signOut({ scope: 'local' }), 4000)
      if (error) throw error
    } catch {
    } finally {
      signingOutRef.current = false
    }
  }, [])

  /* ================================
     Context Value
  ================================ */
  const value = useMemo(() => ({
    session,
    profile,
    permissions,

    authReady,
    profileReady,

    refreshProfile,
    loadPermissions,
    signOut,

    isAdmin: profile?.cargo === 'ADMIN'
  }), [
    session,
    profile,
    permissions,
    authReady,
    profileReady,
    refreshProfile,
    loadPermissions,
    signOut
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/* ================================
   Hook
================================ */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
