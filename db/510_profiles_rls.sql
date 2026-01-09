-- Habilitar RLS (é boa prática manter habilitado, mesmo que as políticas sejam permissivas)
alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- POLÍTICAS PERMISSIVAS (ACESSO TOTAL PARA AUTENTICADOS)
-- Conforme solicitado: "sem bloqueio de permissao por enquanto"
-- -----------------------------------------------------------------------------

-- 1. SELECT: Todos os usuários autenticados podem ver todos os perfis
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
  on public.profiles for select
  to authenticated
  using (true);

-- 2. UPDATE: Todos os usuários autenticados podem editar qualquer perfil
-- (Cuidado: isso permite que qualquer um edite o perfil de qualquer um)
drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy
  on public.profiles for update
  to authenticated
  using (true)
  with check (true);

-- 3. DELETE: Todos os usuários autenticados podem deletar perfis
drop policy if exists profiles_delete_policy on public.profiles;
create policy profiles_delete_policy
  on public.profiles for delete
  to authenticated
  using (true);

-- 4. INSERT: Todos os usuários autenticados podem criar perfis (geralmente via trigger, mas deixamos aberto)
drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy
  on public.profiles for insert
  to authenticated
  with check (true);

-- -----------------------------------------------------------------------------
-- STORAGE POLICIES (AVATARS) - Também permissivas
-- -----------------------------------------------------------------------------

drop policy if exists "avatars_authenticated_select" on storage.objects;
create policy "avatars_authenticated_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');

-- -----------------------------------------------------------------------------
-- PERMISSOES (TABELAS AUXILIARES)
-- -----------------------------------------------------------------------------

alter table public.profile_permissoes enable row level security;

drop policy if exists profile_permissoes_select_policy on public.profile_permissoes;
create policy profile_permissoes_select_policy
  on public.profile_permissoes for select
  to authenticated
  using (true);

drop policy if exists profile_permissoes_write_policy on public.profile_permissoes;
create policy profile_permissoes_write_policy
  on public.profile_permissoes for insert
  to authenticated
  with check (true);

drop policy if exists profile_permissoes_update_policy on public.profile_permissoes;
create policy profile_permissoes_update_policy
  on public.profile_permissoes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists profile_permissoes_delete_policy on public.profile_permissoes;
create policy profile_permissoes_delete_policy
  on public.profile_permissoes for delete
  to authenticated
  using (true);
