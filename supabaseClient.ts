
import { createClient } from '@supabase/supabase-js';
import { logInfo, logWarn } from './utils/logger';
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseUrl = rawUrl?.replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
export const SUPABASE_URL = supabaseUrl;
try {
  const masked = supabaseAnonKey ? `${supabaseAnonKey.substring(0, 6)}...` : 'missing'
  logInfo('supabase', 'client init', { url: supabaseUrl, anonKey: masked })
  if (!supabaseUrl || !supabaseAnonKey) logWarn('supabase', 'missing env vars')
} catch {}
