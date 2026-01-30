-- =============================================================================
-- SCRIPT DE CORREÇÃO CRÍTICA - PERFIS E PERMISSÕES
-- =============================================================================
-- Este script remove todas as políticas antigas que podem estar referenciando
-- a coluna excluída "role" e recria as políticas corretas.
--
-- RODE ESTE SCRIPT NO EDITOR SQL DO SUPABASE
-- =============================================================================

-- 1. Remover políticas antigas da tabela profiles (limpeza total)
drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;
drop policy if exists profiles_delete_policy on public.profiles;
drop policy if exists profiles_insert_policy on public.profiles;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

-- 2. Recriar políticas permissivas (Evita erro de coluna inexistente)
--    Usamos "using (true)" para garantir que o SELECT nunca falhe por erro de coluna.

create policy profiles_select_policy
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_policy
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_insert_policy
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 3. Garantir que a tabela profiles tenha a estrutura correta (sem erros de tipo)
--    Isso é seguro de rodar mesmo se a coluna já existir.

do $$
begin
    -- Se a coluna cargo não existir, adicionar (apenas precaução)
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'cargo') then
        alter table public.profiles add column cargo text; -- ou enum se já existir
    end if;
end $$;

-- 4. Atualizar permissões do Storage (Avatars) para não usar 'role'
drop policy if exists "avatars_authenticated_select" on storage.objects;
drop policy if exists "avatars_authenticated_insert" on storage.objects;
drop policy if exists "avatars_authenticated_update" on storage.objects;
drop policy if exists "avatars_authenticated_delete" on storage.objects;

create policy "avatars_authenticated_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "avatars_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and auth.uid() = owner);

create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and auth.uid() = owner);

-- 5. Forçar atualização do cache de schema do PostgREST
NOTIFY pgrst, 'reload config';
