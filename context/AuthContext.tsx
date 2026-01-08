import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { Profile, ProfilePermissao } from '../types'

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
  
  // Refs para controle de montagem e concorrência
  const mounted = useRef(true)
  const isFetchingProfile = useRef(false)
  const profileRef = useRef<Profile | null>(null)
  const sessionRef = useRef<Session | null>(null)

  // Mantém refs atualizados
  useEffect(() => {
    profileRef.current = profile
    sessionRef.current = session
  }, [profile, session])

  // ============================
  // Helper: Create Fallback Profile
  // ============================
  const createFallbackProfile = useCallback((user: Session['user']): Profile => ({
    id: user.id,
    nome: (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || user.email || 'Usuário',
    email_login: user.email || '',
    role: 'user', // Fallback role, mas UI não deve bloquear por isso
    status: 'online',
    ativo: true,
    created_at: new Date().toISOString()
  }), [])

  // ============================
  // Load Profile Logic
  // ============================
  const loadProfile = useCallback(async (currentSession: Session) => {
    // Evita chamadas simultâneas (Lock)
    if (isFetchingProfile.current) return
    
    try {
      isFetchingProfile.current = true
      console.log('[Auth] Buscando perfil para:', currentSession.user.id)
      setError(null)

      // Usa maybeSingle para evitar erros 406/JSON se retornar 0 linhas
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .eq('email_login', currentSession.user.email) // Força match também por email para segurança extra
        .maybeSingle()

      if (profileErr) {
        console.warn('[Auth] Erro técnico ao buscar perfil:', profileErr.message)
        
        // Se for erro de rede ou permissão, usamos cache ou fallback
        if (!mounted.current) return
        setProfile(prev => {
            // Se o ID do profile anterior bate com o da sessão atual, mantemos ele (cache válido)
            if (prev && prev.id === currentSession.user.id) return prev
            // Se não tem cache, retornamos null para forçar loading (não cria user fake)
            // Isso evita downgrade de permissão acidental
            return null
        })
      } else if (!profileData) {
        // Sucesso na query, mas 0 resultados (PGRST116 equivalente)
        console.warn('[Auth] Perfil não encontrado no banco (ID mismatch?).')
        if (!mounted.current) return
        // Perfil não existe mesmo -> Agora sim podemos usar fallback ou deslogar (opcional)
        // Aqui usamos fallback para não travar, mas com aviso
        setProfile(prev => {
            if (prev && prev.id === currentSession.user.id) return prev
            return createFallbackProfile(currentSession.user)
        })
      } else {
        // Sucesso total
        if (!mounted.current) return
        setProfile(profileData)
        // Salva no cache
        localStorage.setItem('systemflow-profile-cache', JSON.stringify(profileData))
      }

      // Carrega permissões em paralelo (não bloqueante)
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
      console.error('[Auth] Erro fatal loadProfile:', err)
      
      if (!mounted.current) return

      const message = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : ''
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : ''
      
      // LOGOUT APENAS EM CASOS CRÍTICOS DE SEGURANÇA (401)
      const isAuthError = code === '401' || (typeof message === 'string' && (message.includes('JWT') || message.includes('token') || message.includes('invalid_grant')))
      
      if (isAuthError) {
          console.warn('[Auth] Sessão inválida (401). Realizando logout.')
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
          setPermissions([])
      } else {
          // Resiliência total contra outros erros
          console.warn('[Auth] Erro recuperável. Mantendo sessão.')
          setProfile(prev => prev || createFallbackProfile(currentSession.user))
      }
    } finally {
      isFetchingProfile.current = false
      if (mounted.current) {
          setLoading(false)
      }
    }
  }, [createFallbackProfile])

  // ============================
  // Initialization & Listeners
  // ============================
  useEffect(() => {
    mounted.current = true
    
    // Tenta recuperar do cache local primeiro para evitar flash de "User"
    const cachedProfileStr = localStorage.getItem('systemflow-profile-cache')
    const cachedPermsStr = localStorage.getItem('systemflow-permissions-cache')
    
    if (cachedProfileStr) {
        try {
            const cachedProfile = JSON.parse(cachedProfileStr)
            setProfile(cachedProfile)
            
            if (cachedPermsStr) {
                const cachedPerms = JSON.parse(cachedPermsStr)
                setPermissions(cachedPerms)
            }
        } catch {}
    }
    
    const initAuth = async () => {
        try {
            console.log('[Auth] Inicializando...')
            // 1. Tenta recuperar sessão do storage
            const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError) throw sessionError

            if (!mounted.current) return

            if (initialSession) {
                setSession(initialSession)
                await loadProfile(initialSession)
            } else {
                setLoading(false)
            }
        } catch (err) {
            console.error('[Auth] Falha na inicialização:', err)
            if (mounted.current) setLoading(false)
        }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log(`[Auth] Evento: ${event}`)
        if (!mounted.current) return

        // INITIAL_SESSION: Ignora se já temos sessão (evita race condition com initAuth)
        if (event === 'INITIAL_SESSION') {
             if (newSession && !sessionRef.current) {
                 setSession(newSession)
                 await loadProfile(newSession)
             }
             return
        }

        if (event === 'SIGNED_OUT' || !newSession) {
            setSession(null)
            setProfile(null)
            setPermissions([])
            setLoading(false)
            return
        }

        const currentToken = sessionRef.current?.access_token
        const newToken = newSession.access_token
        
        // Atualiza sessão se mudou
        if (currentToken !== newToken) {
            setSession(newSession)
        }

        // Lógica de reload de perfil:
        // 1. Login explícito -> Carrega
        // 2. User Updated -> Carrega
        // 3. Token Refresh -> SÓ carrega se não tivermos perfil (evita reload desnecessário e loops)
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            await loadProfile(newSession)
        } else if (event === 'TOKEN_REFRESHED') {
            if (!profileRef.current) {
                await loadProfile(newSession)
            }
        }
    })

    return () => {
        mounted.current = false
        subscription.unsubscribe()
    }
  }, []) 

  // ============================
  // Actions
  // ============================
  const signOut = useCallback(async () => {
    try {
        setLoading(true)
        // Race condition: Timeout vs Supabase SignOut
        // Se o supabase demorar mais que 2s, forçamos o logout local
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        await Promise.race([supabase.auth.signOut(), timeoutPromise])
    } catch (err) {
        console.warn('Logout (network/timeout):', err)
    } finally {
        if (mounted.current) {
            try {
              localStorage.clear() 
              localStorage.removeItem('systemflow-profile-cache')
              localStorage.removeItem('systemflow-permissions-cache')
            } catch {}
            
            setSession(null)
            setProfile(null)
            setPermissions([])
            setLoading(false)
            setError(null)
            // Force redirect para garantir limpeza visual
            // navigate não está disponível aqui, mas o ProtectedRoute deve pegar
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

  // Computed Context Value
  const value = useMemo(() => {
      // Safe Profile Pattern: Nunca retorna null se existe sessão
      let safeProfile = profile
      if (session && !safeProfile) {
          safeProfile = createFallbackProfile(session.user)
      }

      return {
        session,
        profile: safeProfile,
        permissions,
        perms: permissions,
        loading,
        error,
        signOut,
        isAdmin: safeProfile?.role === 'admin',
        refreshProfile
      }
  }, [session, profile, permissions, loading, error, signOut, refreshProfile, createFallbackProfile])

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
