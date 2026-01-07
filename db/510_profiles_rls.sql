alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete
  on public.profiles for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (owner = auth.uid())
      or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (owner = auth.uid())
      or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (owner = auth.uid())
      or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create table if not exists public.permissoes (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  submodulo text not null,
  descricao text
);

create table if not exists public.profile_permissoes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permissao_id uuid not null references public.permissoes(id) on delete cascade,
  visualizar boolean not null default true,
  editar boolean not null default false,
  excluir boolean not null default false,
  primary key (profile_id, permissao_id)
);

alter table public.profile_permissoes enable row level security;

drop policy if exists profile_permissoes_self_select on public.profile_permissoes;
create policy profile_permissoes_self_select
  on public.profile_permissoes for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists profile_permissoes_admin_write on public.profile_permissoes;
create policy profile_permissoes_admin_write
  on public.profile_permissoes for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists profile_permissoes_admin_update on public.profile_permissoes;
create policy profile_permissoes_admin_update
  on public.profile_permissoes for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists profile_permissoes_admin_delete on public.profile_permissoes;
create policy profile_permissoes_admin_delete
  on public.profile_permissoes for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
