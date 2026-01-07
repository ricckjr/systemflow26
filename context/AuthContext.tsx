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

  // ============================
  // Load Profile Logic
  // ============================
  const loadProfile = useCallback(async (currentSession: Session) => {
    // Evita chamadas simultâneas para o mesmo usuário se já estiver rodando
    // Mas permite se for um retry forçado (loading=true externamente)
    // Aqui vamos simplificar: se já está buscando, deixa terminar.
    if (isFetchingProfile.current) return
    
    try {
      isFetchingProfile.current = true
      
      // Nota: Não setamos loading(true) aqui automaticamente para não causar 
      // flicker em refreshes silenciosos. Quem chama decide se quer bloquear a UI.

      console.log('[Auth] Buscando perfil para:', currentSession.user.id)
      setError(null)

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single()

      if (profileErr) {
        if (profileErr.code === 'PGRST116') {
          const fallbackProfile: Profile = {
            id: currentSession.user.id,
            nome: (currentSession.user.user_metadata as any)?.name || currentSession.user.email || 'Usuário',
            email_login: currentSession.user.email || '',
            role: 'user',
            status: 'online',
            ativo: true,
            created_at: new Date().toISOString()
          }
          if (!mounted.current) return
          setProfile(fallbackProfile)
        } else {
          throw profileErr
        }
      } else {
        if (!mounted.current) return
        setProfile(profileData)
      }

      // Carrega permissões em paralelo ou sequencial? Sequencial é mais seguro para consistência
      const { data: permsData, error: permErr } = await supabase
        .from('profile_permissoes')
        .select('*, permissoes(*)')
        .eq('profile_id', currentSession.user.id)

      if (permErr) throw permErr

      if (!mounted.current) return
      setPermissions(permsData || [])
      
    } catch (err: unknown) {
      console.error('[Auth] Erro ao carregar perfil:', err)
      
      if (!mounted.current) return

      // Verifica se é erro de autenticação real (Token inválido/expirado)
      const message = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : ''
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : ''
      const isAuthError = code === '401' || (typeof message === 'string' && (message.includes('JWT') || message.includes('token')))
      
      if (isAuthError) {
          console.warn('[Auth] Token inválido detectado. Realizando logout forçado.')
          await supabase.auth.signOut()
          setSession(null)
          setProfile(null)
          setPermissions([])
      } else {
          setError(err instanceof Error ? err : new Error(message || 'Erro desconhecido ao carregar perfil'))
      }
    } finally {
      isFetchingProfile.current = false
      if (mounted.current) {
          // Só define loading false se estivéssemos esperando isso
          // Mas como saber? Geralmente sim.
          setLoading(false)
      }
    }
  }, [])

  // ============================
  // Initialization & Listeners
  // ============================
  useEffect(() => {
    mounted.current = true
    
    const initAuth = async () => {
        try {
            console.log('[Auth] Iniciando verificação de sessão...')
            const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError) throw sessionError

            if (!mounted.current) return

            if (initialSession) {
                console.log('[Auth] Sessão encontrada (Storage).')
                setSession(initialSession)
                const timeoutId = setTimeout(() => {
                  if (mounted.current && loading) {
                    setError(new Error('Ops, sua conexão expirou. Faça login novamente.'))
                    setLoading(false)
                  }
                }, 8000)
                await loadProfile(initialSession)
                clearTimeout(timeoutId)
            } else {
                console.log('[Auth] Nenhuma sessão encontrada.')
                setLoading(false)
            }
        } catch (err) {
            console.error('[Auth] Erro fatal na inicialização:', err)
            if (mounted.current) setLoading(false)
        }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log(`[Auth] Mudança de estado: ${event}`)
        if (!mounted.current) return

        // Evita flutuação desnecessária no INITIAL_SESSION (já tratamos via getSession)
        if (event !== 'INITIAL_SESSION') {
          setSession(newSession)
        }

        if (event === 'SIGNED_OUT') {
            setProfile(null)
            setPermissions([])
            setLoading(false)
            setError(null)
        } else if (newSession) {
            // SIGNED_IN: Login explícito
            // INITIAL_SESSION: Disparado logo após subscribe (pode ser duplicado com getSession, mas loadProfile protege)
            // TOKEN_REFRESHED: Token atualizado automaticamente
            
            if (event === 'SIGNED_IN') {
                 // Garante que temos o perfil carregado
                 // Se loadProfile já estiver rodando (via initAuth), ele vai ignorar ou completar
                 await loadProfile(newSession)
            } else if (event === 'TOKEN_REFRESHED') {
                 // Geralmente não precisamos recarregar perfil no refresh de token, 
                 // a menos que estejamos em erro
                 if (error || !profile) {
                     await loadProfile(newSession)
                 }
            } else if (event === 'USER_UPDATED') {
                await loadProfile(newSession)
            }
        } else {
            // Caso raro: newSession null mas não é SIGNED_OUT
            setLoading(false)
        }
    })

    return () => {
        mounted.current = false
        subscription.unsubscribe()
    }
  }, [loadProfile]) 

  // ============================
  // Actions
  // ============================
  const signOut = useCallback(async () => {
    try {
        setLoading(true)
        await supabase.auth.signOut()
    } catch (err) {
        console.error('Erro no logout:', err)
    } finally {
        if (mounted.current) {
            try {
              Object.keys(localStorage).forEach(k => {
                if (k.startsWith('sb-')) localStorage.removeItem(k)
              })
            } catch {}
            setSession(null)
            setProfile(null)
            setPermissions([])
            setLoading(false)
            setError(null)
        }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session) {
        setLoading(true)
        // Força limpeza de erro ao tentar novamente
        setError(null)
        // Pequeno delay para garantir UI feedback
        await loadProfile(session)
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
