import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'

export interface UsuarioSimples {
  id: string
  nome: string
  cargo: string | null
  avatar_url: string | null
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, nome, cargo, avatar_url')
          .eq('ativo', true)
          .order('nome')
        
        if (data) {
          setUsuarios(data)
        }
      } catch (error) {
        console.error('Erro ao carregar usuários:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { usuarios, loading }
}
