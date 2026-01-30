create or replace function public.update_updated_at_column() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  alter column avatar_url drop default;

alter table public.profiles
  alter column updated_at set default now();

alter table public.profiles
  alter column created_at set default now();

alter table public.profiles
  alter column nome set not null;

alter table public.profiles
  alter column email_login set not null;

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  alter column ativo set not null;

alter table public.profiles
  alter column status set not null;

alter table public.profiles
  alter column departamento set not null;

alter table public.profiles
  alter column departamento set default 'MASTER'::public.departamento_enum;

alter table public.profiles
  alter column role set default 'user'::text;

alter table public.profiles
  alter column status set default 'offline'::public.user_status_enum;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');
