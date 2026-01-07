import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Layout from './Layout'
import { useAuth } from '../context/AuthContext'
import { Profile, ProfilePermissao } from '../types'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, permissions, loading, error, refreshProfile, signOut } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0b1e2d] text-white gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-white/60">Validando sua sessão segura...</p>
      </div>
    )
  }
  
  if (!session) {
     return <Navigate to="/login" replace state={{ message: 'Ops, sua conexão expirou. Faça login novamente.' }} />
  }

  // Se houver erro crítico de carregamento de perfil (ex: falha de rede persistente)
  if (error) {
    return (
       <div className="h-screen flex flex-col items-center justify-center bg-[#0b1e2d] text-white gap-6 p-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Falha ao carregar perfil</h2>
            <p className="text-white/60 text-sm max-w-md">
              Não foi possível conectar ao servidor para carregar seus dados. Verifique sua conexão.
            </p>
            {error.message && (
               <p className="text-red-400/80 text-xs font-mono bg-black/20 p-2 rounded border border-red-500/10 max-w-md overflow-auto">
                 {error.message}
               </p>
            )}
          </div>
          <div className="flex gap-3">
            <button 
                onClick={() => refreshProfile()} 
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-bold text-sm shadow-lg shadow-blue-900/20"
            >
                Tentar Novamente
            </button>
            <button 
                onClick={() => signOut()} 
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all font-bold text-sm"
            >
                Sair
            </button>
          </div>
       </div>
    )
  }

  // Se profile for nulo mas sem erro (caso raro, mas possível se AuthContext falhar silenciosamente)
  if (!profile) {
      return (
       <div className="h-screen flex flex-col items-center justify-center bg-[#0b1e2d] text-white gap-4">
          <div className="text-center space-y-2">
             <h2 className="text-lg font-bold text-white">Perfil Indisponível</h2>
             <p className="text-white/60 text-sm">Não foi possível recuperar seus dados de perfil.</p>
          </div>
          <div className="flex gap-3">
            <button 
                onClick={() => refreshProfile()} 
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors font-bold text-sm"
            >
                Tentar Novamente
            </button>
            <button 
                onClick={() => signOut()} 
                className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors font-bold text-sm"
            >
                Sair
            </button>
          </div>
       </div>
    )
  }

  return (
    <Layout profile={profile} perms={permissions as ProfilePermissao[]}>
      {children || <Outlet />}
    </Layout>
  )
}
