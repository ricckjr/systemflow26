import { supabase } from '@/services/supabase'
import { Profile } from '@/types'

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Profile[] || []
}

export async function searchProfilesByName(query: string, limit = 8) {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, avatar_url')
    .ilike('nome', `%${q}%`)
    .limit(limit)
  if (error) return []
  return (data ?? []) as Pick<Profile, 'id' | 'nome' | 'avatar_url'>[]
}
