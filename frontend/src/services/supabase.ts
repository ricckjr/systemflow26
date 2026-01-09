
import { createClient } from '@supabase/supabase-js';
import { logInfo, logWarn } from '@/utils/logger';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseUrl = rawUrl?.trim().replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim();

// Singleton pattern for HMR safety
// Evita que o cliente seja recriado a cada hot-reload, mantendo a conexão realtime e sessão estáveis.
const globalSupabase = globalThis as unknown as { __systemflow_supabase: ReturnType<typeof createClient> };

export const supabase = globalSupabase.__systemflow_supabase || createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Desabilitado para evitar conflitos de hash na URL durante reload
    storageKey: 'systemflow-auth-token', // Chave única para evitar colisão com outros projetos locais
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalSupabase.__systemflow_supabase = supabase;
}

export const SUPABASE_URL = supabaseUrl;

try {
  const masked = supabaseAnonKey ? `${supabaseAnonKey.substring(0, 6)}...` : 'missing'
  logInfo('supabase', 'client init', { url: supabaseUrl, anonKey: masked })
  if (!supabaseUrl || !supabaseAnonKey) logWarn('supabase', 'missing env vars')
} catch {}
