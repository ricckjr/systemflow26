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
import { logInfo, logError, logWarn } from '@/utils/logger'
import { decodeJwt, isJwtExpired } from '@/utils/jwt'

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  permissions: ProfilePermissao[]
  perms: ProfilePermissao[]
  loading: boolean
  error: Error | null
  signOut: () => Promise<void>
  isAdmin: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROFILE_CACHE_KEY = 'systemflow-profile-cache'
const PERMS_CACHE_KEY   = 'systemflow-permissions-cache'

function safeParse<T>(v: string | null): T | null {
  if (!v) return null
  try { return JSON.parse(v) } catch { return null }
}

// Helper to ensure profile has cargo instead of role
function normalizeProfile(p: any): Profile | null {
  if (!p) return null
  // If we have 'role' but no 'cargo', map it
  if (p.role && !p.cargo) {
     const roleMap: Record<string, any> = {
         'admin': 'ADMIN',
         'user': 'VENDEDOR'
     }
     p.cargo = roleMap[p.role.toLowerCase()] || 'VENDEDOR'
  }
  return p as Profile
}

function isRealAuthError(err: any) {
  const status = err?.status || err?.statusCode
  const msg = String(err?.message || '').toLowerCase()
  return (
    status === 401 ||
    msg.includes('invalid jwt') ||
    msg.includes('session expired')
  )
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<ProfilePermissao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const mounted = useRef(true)
  // Use a Promise ref to handle concurrent requests correctly
  const loadProfilePromise = useRef<Promise<void> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialized = useRef(false)
  const sessionRef = useRef<Session | null>(null)
  const profileRef = useRef<Profile | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { profileRef.current = profile }, [profile])

  // ============================
  // Load Profile
  // ============================
  const loadProfile = useCallback(async (currentSession: Session, silent = false) => {
    // Race condition handling: Wait for existing promise if any (não aborta a request ativa)
    if (loadProfilePromise.current) {
        if (!silent && !profileRef.current) setLoading(true)
        try {
            await loadProfilePromise.current
        } catch (e) {
            // Ignore error from shared promise
        } finally {
            if (mounted.current && !silent && !profileRef.current) setLoading(false)
        }
        return
    }

    // 1. Abort previous request if active (apenas quando vamos iniciar uma nova)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    if (!silent && !profileRef.current) setLoading(true)
    setError(null)

    const task = async () => {
      // Retry x3 (proxy / cold start / kong)
      let data: Profile | null = null
      let err: any = null

      for (let i = 0; i < 3; i++) {
        if (controller.signal.aborted) return // Early exit

        // Add timeout to fetch to prevent hanging
        const fetchPromise = supabase
          .from('profiles')
          .select('id, nome, email_login, email_corporativo, telefone, ramal, ativo, avatar_url, created_at, updated_at, cargo')
          .eq('id', currentSession.user.id)
          .abortSignal(controller.signal) // Supabase supports abortSignal
          .maybeSingle()
        
        const timeoutPromise = new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout loading profile')), 10000)
        )

        try {
            const res = await Promise.race([fetchPromise, timeoutPromise])
            if (!res.error && res.data) {
                data = res.data
                err = null
                break
            }
            err = res.error
        } catch (e: any) {
            if (e.name === 'AbortError') return // Silent exit
            err = e
        }
        
        if (i < 2 && !controller.signal.aborted) await new Promise(r => setTimeout(r, 500 * (i + 1)))
      }

      if (controller.signal.aborted) return

      if (err) throw err

      if (!mounted.current) return

      // Se veio do banco → atualiza + cache
      if (data) {
        // Ensure data is normalized before saving
        data = normalizeProfile(data)!
        setProfile(data)
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data))
      } else {
        // Se não veio, tenta preservar cache/estado
        let cached = safeParse<any>(localStorage.getItem(PROFILE_CACHE_KEY))
        cached = normalizeProfile(cached)
        
        if (cached && cached.id === currentSession.user.id) {
          logWarn('auth', 'DB empty, using cached profile', { id: cached.id })
          setProfile(cached)
        } else if (profileRef.current?.id === currentSession.user.id) {
          logWarn('auth', 'DB empty, preserving state profile', { id: profileRef.current.id })
        } else {
          setProfile(null)
        }
      }

      // Permissões
      if (!controller.signal.aborted) {
          const { data: perms } = await supabase
            .from('profile_permissoes')
            .select('*, permissoes(*)')
            .eq('profile_id', currentSession.user.id)
            .abortSignal(controller.signal)

          if (mounted.current && !controller.signal.aborted) {
            setPermissions(perms || [])
            if (perms) localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(perms))
          }
      }
    }

    // Assign the task to the promise ref
    loadProfilePromise.current = task()

    try {
      await loadProfilePromise.current
    } catch (e: any) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      
      if (!mounted.current) return

      if (isRealAuthError(e)) {
        logWarn('auth', 'real auth error → logout', e)
        try { await supabase.auth.signOut() } catch {}
        setSession(null)
        setProfile(null)
        setPermissions([])
        localStorage.removeItem(PROFILE_CACHE_KEY)
        localStorage.removeItem(PERMS_CACHE_KEY)
      } else {
        logWarn('auth', 'network/profile error, keeping cache', e)
        let cached = safeParse<any>(localStorage.getItem(PROFILE_CACHE_KEY))
        cached = normalizeProfile(cached)
        if (cached) {
          setProfile(cached)
          // Se temos cache, não bloqueamos o usuário com erro visual, apenas logamos
          setError(null) 
        } else {
          setError(new Error('Falha temporária ao sincronizar perfil'))
        }
      }
    } finally {
      // Clear the promise ref
      loadProfilePromise.current = null
      if (mounted.current && !silent && abortControllerRef.current === controller) setLoading(false)
    }
  }, [])

  // ============================
  // Init + Listener
  // ============================
  useEffect(() => {
    mounted.current = true

    // Safety timeout to prevent infinite loading loop (15s max)
    const safetyTimer = setTimeout(() => {
        if (loading && mounted.current) {
            console.warn('AuthContext: Force stopping loading state after timeout')
            setLoading(false)
        }
    }, 15000)

    // Pré-carrega cache
    let cachedProfile = safeParse<any>(localStorage.getItem(PROFILE_CACHE_KEY))
    const cachedPerms   = safeParse<ProfilePermissao[]>(localStorage.getItem(PERMS_CACHE_KEY))
    
    // Normalize legacy cache
    cachedProfile = normalizeProfile(cachedProfile)

    if (cachedProfile) setProfile(cachedProfile)
    if (cachedPerms) setPermissions(cachedPerms)

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted.current) return

        if (!data.session) {
          setLoading(false)
          initialized.current = true
          return
        }

        setSession(data.session)

        // Se temos cache → libera UI já
        if (cachedProfile) {
          setLoading(false)
          void loadProfile(data.session, true)
        } else {
          await loadProfile(data.session, false)
        }

        initialized.current = true
      } catch {
        if (mounted.current) setLoading(false)
        initialized.current = true
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return

      if (event === 'INITIAL_SESSION') {
        if (initialized.current) return
        if (!newSession) {
          setLoading(false)
          initialized.current = true
          return
        }

        setSession(newSession)
        const cached = safeParse<Profile>(localStorage.getItem(PROFILE_CACHE_KEY))
        if (cached) {
          setProfile(cached)
          setLoading(false)
          void loadProfile(newSession, true)
        } else {
          await loadProfile(newSession, false)
        }

        initialized.current = true
        return
      }

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null)
        setProfile(null)
        setPermissions([])
        setLoading(false)
        localStorage.removeItem(PROFILE_CACHE_KEY)
        localStorage.removeItem(PERMS_CACHE_KEY)
        return
      }

      // Atualiza sessão se token mudou
      if (sessionRef.current?.access_token !== newSession.access_token) {
        setSession(newSession)
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await loadProfile(newSession, true)
      }

      if (event === 'TOKEN_REFRESHED') {
        if (!profileRef.current) {
          void loadProfile(newSession, true)
        }
      }
    })

    return () => {
      mounted.current = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // ============================
  // Actions
  // ============================
  const signOut = useCallback(async () => {
    setLoading(true)

    // 1. Limpeza LOCAL (Garante saída visual imediata)
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY)
      localStorage.removeItem(PERMS_CACHE_KEY)
      localStorage.removeItem('systemflow-auth-token') // Remove o token específico do app
      
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-')) localStorage.removeItem(k)
      })
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('sb-')) sessionStorage.removeItem(k)
      })
    } catch {}

    // 2. Limpeza ESTADO
    setSession(null)
    setProfile(null)
    setPermissions([])
    setError(null)

    // 3. Logout SERVIDOR
    // Omitimos a chamada de rede (supabase.auth.signOut) pois ela frequentemente
    // causa erros "net::ERR_ABORTED" quando seguida imediatamente por um reload/navegação.
    // Como removemos o token localmente, o usuário está efetivamente deslogado neste dispositivo.
    
    setLoading(false)
    // Força recarregamento ou redirecionamento para garantir limpeza, apenas se não estiver no login
    if (window.location.pathname !== '/login') {
        window.location.href = '/login'
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    await loadProfile(session, false)
  }, [session, loadProfile])

  const value = useMemo(() => ({
    session,
    profile,
    permissions,
    perms: permissions,
    loading,
    error,
    signOut,
    isAdmin: profile?.cargo === 'ADMIN',
    refreshProfile
  }), [session, profile, permissions, loading, error, signOut, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
