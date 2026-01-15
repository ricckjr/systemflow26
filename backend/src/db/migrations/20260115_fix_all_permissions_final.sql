-- 🚨 FIX GERAL DE PERMISSÕES (Profiles + Chat) 🚨
-- Resolve: "AuthContext Timeout", "net::ERR_ABORTED" e erros de carregamento.

-- ==============================================================================
-- 1. TABELA PROFILES (O Coração do Auth)
-- ==============================================================================

-- A. Permissões de Acesso (GRANT)
GRANT ALL ON TABLE public.profiles TO postgres;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- B. Segurança (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- C. Políticas de Leitura (Quem pode ver quem?)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Vamos permitir que todos vejam nomes/avatares (necessário para Chat e CRM)
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- D. Políticas de Edição (Só o dono edita)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- ==============================================================================
-- 2. TABELA CHAT NOTIFICATIONS (O motivo do erro original)
-- ==============================================================================

GRANT ALL ON TABLE public.chat_notifications TO authenticated;
GRANT ALL ON TABLE public.chat_notifications TO service_role;

ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Own Notifications" ON public.chat_notifications;
CREATE POLICY "View Own Notifications" 
ON public.chat_notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update Own Notifications" ON public.chat_notifications;
CREATE POLICY "Update Own Notifications" 
ON public.chat_notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 3. PERMISSÕES DE SISTEMA (Profile Permissoes)
-- ==============================================================================

GRANT ALL ON TABLE public.profile_permissoes TO authenticated;
GRANT ALL ON TABLE public.profile_permissoes TO service_role;

ALTER TABLE public.profile_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Own Permissions" ON public.profile_permissoes;
CREATE POLICY "View Own Permissions" 
ON public.profile_permissoes FOR SELECT 
TO authenticated 
USING (profile_id = auth.uid());
