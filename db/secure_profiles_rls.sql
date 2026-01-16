-- ==============================================================================
-- 🔒 SECURE PROFILES RLS
-- Data: 2026-01-16
-- Descrição: Blinda a tabela profiles contra edições não autorizadas.
-- Mantém leitura pública para não quebrar a UI, mas restringe escrita.
-- ==============================================================================

-- 1. Garante RLS habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas (permissivas)
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

-- 3. Cria Novas Políticas

-- SELECT: Permite ver todos (Necessário para listar usuários, chat, tarefas)
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Permite criar o próprio perfil (geralmente automático, mas ok manter)
CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Apenas o dono pode editar seus dados
-- (Futuramente adicionar OR is_admin() se necessário, mas com cuidado com recursão)
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Apenas o dono (ou ninguém, geralmente soft delete é melhor)
CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 4. Notificação de Segurança
COMMENT ON TABLE public.profiles IS 'Tabela de perfis com RLS ativo: Leitura pública, Escrita restrita ao dono.';
