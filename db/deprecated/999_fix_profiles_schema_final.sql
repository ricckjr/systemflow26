-- ============================================================
-- 🛠️ SCRIPT DE CORREÇÃO: Tabela Profiles e Enum Cargo
-- Data: 2026-01-13
-- Descrição: Recria a estrutura da tabela profiles e garante tipos
-- ============================================================

-- 1. Criação do Enum 'cargo_enum' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_enum') THEN
        CREATE TYPE public.cargo_enum AS ENUM (
            'ADMIN',
            'VENDEDOR',
            'MARKETING',
            'ADMINISTRATIVO',
            'FINANCEIRO',
            'RECURSOS_HUMANOS',
            'DEPARTAMENTO_PESSOAL',
            'LOGISTICA',
            'OFICINA',
            'TECNICO'
        );
    END IF;
END$$;

-- 2. Recriação da Tabela 'profiles'
-- ATENÇÃO: Se a tabela já existir e tiver dados incompatíveis, isso pode falhar ou requerer migração de dados.
-- O script abaixo tenta ajustar ou criar se não existir.

CREATE TABLE IF NOT EXISTS public.profiles ( 
   id uuid not null, 
   nome text not null, 
   email_login text not null, 
   email_corporativo text null, 
   telefone text null, 
   ramal text null, 
   ativo boolean not null default true, 
   avatar_url text null, 
   created_at timestamp with time zone null default now(), 
   updated_at timestamp with time zone null default now(), 
   cargo public.cargo_enum null, 
   constraint profiles_pkey primary key (id), 
   constraint profiles_auth_fkey foreign KEY (id) references auth.users (id) on delete CASCADE 
) TABLESPACE pg_default;

-- Se a tabela já existir mas faltar colunas, você pode rodar comandos ALTER TABLE individuais:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_login text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_corporativo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ramal text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean default true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo public.cargo_enum;

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at_column();
