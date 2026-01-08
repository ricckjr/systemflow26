import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import { Profile, ProfilePermissao } from '../../types'
import { logInfo, logError, logWarn } from '../../utils/logger'
import { decodeJwt, isJwtExpired } from '../../utils/jwt'

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<ProfilePermissao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const mounted = useRef(true)
  const isFetchingProfile = useRef(false)
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // ============================
  // Load Profile Logic
  // ============================
  const loadProfile = useCallback(async (currentSession: Session) => {
    if (isFetchingProfile.current) return
    
    try {
      isFetchingProfile.current = true
      logInfo('auth', 'loadProfile start', { userId: currentSession.user.id })
      setError(null)

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (profileErr) {
        logError('auth', 'perfil fetch error', profileErr)
        if (mounted.current) {
            setError(new Error(profileErr.message))
            setProfile(null)
        }
      } else if (!profileData) {
        logWarn('auth', 'perfil not found, provisioning minimal')
        const minimal = {
          id: currentSession.user.id,
          nome:
            (currentSession.user?.user_metadata as any)?.full_name ||
            (currentSession.user?.user_metadata as any)?.name ||
            (currentSession.user?.email?.split('@')[0] || ''),
          email_login: currentSession.user.email || '',
          role: 'user',
          status: 'online',
          ativo: true,
          created_at: new Date().toISOString(),
        } as Profile
        try {
          await supabase.from('profiles').upsert({
            id: minimal.id,
            email_login: minimal.email_login,
            nome: minimal.nome,
            role: minimal.role,
            status: minimal.status,
            ativo: minimal.ativo,
            created_at: minimal.created_at,
            updated_at: new Date().toISOString(),
          } as any)
        } catch (e) {
          logWarn('auth', 'minimal profile provision failed', e)
        }
        if (mounted.current) {
          setProfile(minimal)
          localStorage.setItem('systemflow-profile-cache', JSON.stringify(minimal))
        }
      } else {
        if (mounted.current) {
            setProfile(profileData)
            localStorage.setItem('systemflow-profile-cache', JSON.stringify(profileData))
        }
      }

      // Carrega permissões
      const { data: permsData } = await supabase
        .from('profile_permissoes')
        .select('*, permissoes(*)')
        .eq('profile_id', currentSession.user.id)

      if (mounted.current) {
         setPermissions(permsData || [])
         if (permsData) {
             localStorage.setItem('systemflow-permissions-cache', JSON.stringify(permsData))
         }
      }
      
    } catch (err: unknown) {
      logError('auth', 'loadProfile fatal', err)
      if (mounted.current) {
          setError(err instanceof Error ? err : new Error('Erro desconhecido'))
      }
    } finally {
      isFetchingProfile.current = false
      if (mounted.current) {
          setLoading(false)
      }
    }
  }, [])

  // ============================
  // Initialization & Listeners
  // ============================
  useEffect(() => {
    mounted.current = true
    
    // Timeout de segurança para evitar loading infinito
    const safetyTimeout = setTimeout(() => {
        if (mounted.current && loading) {
            console.warn('[Auth] Timeout de segurança atingido. Forçando fim do loading.')
            setLoading(false)
        }
    }, 6000)

    const initAuth = async () => {
        try {
            const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError) throw sessionError

            if (!mounted.current) return

            if (initialSession) {
                const tokenInfo = decodeJwt(initialSession.access_token)
                const expired = isJwtExpired(initialSession.access_token)
                logInfo('auth', 'initial session', { userId: initialSession.user.id, expired })
                if (expired === true) {
                    logWarn('auth', 'access token expired at init; waiting refresh')
                }
                const cachedProfileStr = localStorage.getItem('systemflow-profile-cache')
                const cachedPermsStr = localStorage.getItem('systemflow-permissions-cache')
                if (cachedProfileStr) {
                    try {
                        setProfile(JSON.parse(cachedProfileStr))
                        if (cachedPermsStr) setPermissions(JSON.parse(cachedPermsStr))
                    } catch {}
                }
                setSession(initialSession)
                await loadProfile(initialSession)
            } else {
                setLoading(false)
            }
        } catch (err) {
            logError('auth', 'init failure', err)
            if (mounted.current) setLoading(false)
        }
    }

    // Apenas roda initAuth se não houver um evento de sessão inicial já disparado
    // Mas para garantir, deixamos rodar. O lock no loadProfile cuida de duplicações.
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted.current) return
        
        logInfo('auth', `event ${event}`, undefined)

        if (event === 'SIGNED_OUT' || !newSession) {
            setSession(null)
            setProfile(null)
            setPermissions([])
            setLoading(false)
            localStorage.removeItem('systemflow-profile-cache')
            localStorage.removeItem('systemflow-permissions-cache')
            return
        }

        const currentToken = sessionRef.current?.access_token
        const newToken = newSession.access_token
        
        if (currentToken !== newToken) {
            setSession(newSession)
        }

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
             // Se for INITIAL_SESSION, já pode ter sido tratado pelo initAuth, mas o lock protege
             await loadProfile(newSession)
        } else if (event === 'TOKEN_REFRESHED') {
             const expired = isJwtExpired(sessionRef.current?.access_token)
             logInfo('auth', 'token refreshed', { expiredBefore: expired })
             if (!profile) {
               await loadProfile(newSession)
             }
        }
    })

    return () => {
        mounted.current = false
        clearTimeout(safetyTimeout)
        subscription.unsubscribe()
    }
  }, []) 

  // ============================
  // Actions
  // ============================
  const signOut = useCallback(async () => {
    // 1. Limpeza Otimista: Remove dados locais imediatamente
    try {
        setLoading(true)
        localStorage.removeItem('systemflow-profile-cache')
        localStorage.removeItem('systemflow-permissions-cache')
        
        // Limpa estado React imediatamente para feedback visual rápido
        if (mounted.current) {
            setSession(null)
            setProfile(null)
            setPermissions([])
        }

        // 2. Logout local (evita chamada remota que causa ERR_ABORTED em navegação)
        await supabase.auth.signOut({ scope: 'local' }).catch(err => console.warn('[Auth] Logout local falhou:', err))

    } catch (err) {
        console.error('[Auth] Erro crítico no logout:', err)
    } finally {
        if (mounted.current) {
            setLoading(false)
        }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session) {
        try {
            setLoading(true)
            await loadProfile(session)
        } finally {
            if (mounted.current) setLoading(false)
        }
    }
  }, [session, loadProfile])

  const value = useMemo(() => ({
    session,
    profile,
    permissions,
    perms: permissions,
    loading,
    error,
    signOut,
    isAdmin: profile?.role === 'admin',
    refreshProfile
  }), [session, profile, permissions, loading, error, signOut, refreshProfile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
