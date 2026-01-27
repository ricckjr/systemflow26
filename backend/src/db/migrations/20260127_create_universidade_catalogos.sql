-- Create table universidade_catalogos
create table if not exists universidade_catalogos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  tipo text not null check (tipo in ('Apliflow', 'Tecnotron')),
  capa_url text,
  arquivo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Enable RLS
alter table universidade_catalogos enable row level security;

-- Policies
-- Select: Todos os usuários autenticados podem ver
create policy "Todos podem ver catálogos"
  on universidade_catalogos for select
  using (auth.role() = 'authenticated');

-- Insert: Usuários autenticados
create policy "Usuários autenticados podem criar catálogos"
  on universidade_catalogos for insert
  with check (auth.role() = 'authenticated');

-- Update: Criadores e Admins (simplificado para criadores por enquanto)
create policy "Criadores podem atualizar seus catálogos"
  on universidade_catalogos for update
  using (auth.uid() = created_by);

-- Delete: Criadores
create policy "Criadores podem deletar seus catálogos"
  on universidade_catalogos for delete
  using (auth.uid() = created_by);

-- Storage Bucket
insert into storage.buckets (id, name, public)
values ('universidade-catalogos', 'universidade-catalogos', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Public Access Catalogos" on storage.objects;
create policy "Public Access Catalogos"
  on storage.objects for select
  using ( bucket_id = 'universidade-catalogos' );

drop policy if exists "Authenticated Upload Catalogos" on storage.objects;
create policy "Authenticated Upload Catalogos"
  on storage.objects for insert
  with check ( bucket_id = 'universidade-catalogos' and auth.role() = 'authenticated' );

drop policy if exists "Owner Update Catalogos" on storage.objects;
create policy "Owner Update Catalogos"
  on storage.objects for update
  using ( bucket_id = 'universidade-catalogos' and auth.uid() = owner );

drop policy if exists "Owner Delete Catalogos" on storage.objects;
create policy "Owner Delete Catalogos"
  on storage.objects for delete
  using ( bucket_id = 'universidade-catalogos' and auth.uid() = owner );
