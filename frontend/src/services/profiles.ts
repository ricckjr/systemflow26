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
