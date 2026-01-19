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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
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
  signOut: () => void

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

/* ================================
   Provider
================================ */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mounted = useRef(true)

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<ProfilePermissao[] | null>(null)

  const [authReady, setAuthReady] = useState(false)
  const [profileReady, setProfileReady] = useState(false)

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
      .then(({ data }) => {
        if (!mounted.current) return

        const currentSession = data.session ?? null
        setSession(currentSession)
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
        setSession(null)
        setAuthReady(true)
        setProfile(null)
        setPermissions(null)
        setProfileReady(true)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, newSession) => {
        if (!mounted.current) return

        setSession(newSession)
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
    )

    return () => {
      mounted.current = false
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
  const signOut = useCallback(() => {
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(PERMS_CACHE_KEY)

    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })

    setSession(null)
    setProfile(null)
    setPermissions(null)
    setAuthReady(false)
    setProfileReady(false)

    supabase
      .rpc('update_user_status', { new_status: 'offline' })
      .catch(() => {})
      .finally(() => {
        supabase.auth.signOut().finally(() => {
          window.location.href = '/login'
        })
      })
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
