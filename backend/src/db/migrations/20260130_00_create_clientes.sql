BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_tipo_pessoa_enum') THEN
    CREATE TYPE public.cliente_tipo_pessoa_enum AS ENUM ('FISICA', 'JURIDICA');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_regime_tributario_enum') THEN
    CREATE TYPE public.cliente_regime_tributario_enum AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.clientes_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cliente_documento IS NOT NULL THEN
    NEW.cliente_documento := regexp_replace(NEW.cliente_documento, '\D', '', 'g');
  END IF;

  IF NEW.cliente_email IS NOT NULL THEN
    NEW.cliente_email := lower(btrim(NEW.cliente_email));
  END IF;

  IF NEW.cliente_uf IS NOT NULL THEN
    NEW.cliente_uf := upper(btrim(NEW.cliente_uf));
  END IF;

  IF NEW.cliente_pais IS NOT NULL THEN
    NEW.cliente_pais := upper(btrim(NEW.cliente_pais));
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.clientes (
  cliente_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integ_id TEXT,

  cliente_nome_razao_social TEXT NOT NULL,
  cliente_nome_fantasia TEXT,
  cliente_documento TEXT,
  cliente_tipo_pessoa public.cliente_tipo_pessoa_enum NOT NULL,
  cliente_vertical TEXT,

  cliente_email TEXT,
  cliente_telefone TEXT,

  cliente_cep TEXT,
  cliente_endereco TEXT,
  cliente_numero TEXT,
  cliente_complemento TEXT,
  cliente_bairro TEXT,
  cliente_cidade TEXT,
  cliente_uf TEXT,
  cliente_pais TEXT NOT NULL DEFAULT 'BR',

  cliente_inscricao_estadual TEXT,
  cliente_inscricao_municipal TEXT,
  cliente_optante_simples_nacional BOOLEAN NOT NULL DEFAULT false,
  cliente_regime_tributario public.cliente_regime_tributario_enum,

  cliente_website TEXT,
  cliente_instagram TEXT,
  cliente_facebook TEXT,
  cliente_linkedin TEXT,

  cliente_origem_lead TEXT,
  cliente_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  cliente_observacoes TEXT,

  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'clientes'
      AND c.conname = 'clientes_documento_len_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_documento_len_check CHECK (
        cliente_documento IS NULL OR (
          cliente_tipo_pessoa = 'FISICA' AND cliente_documento ~ '^\d{11}$'
        ) OR (
          cliente_tipo_pessoa = 'JURIDICA' AND cliente_documento ~ '^\d{14}$'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'clientes'
      AND c.conname = 'clientes_uf_len_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_uf_len_check CHECK (
        cliente_uf IS NULL OR char_length(cliente_uf) = 2
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_clientes_before_write'
  ) THEN
    CREATE TRIGGER trg_clientes_before_write
    BEFORE INSERT OR UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.clientes_before_write();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(cliente_nome_razao_social);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON public.clientes(cliente_documento);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_documento_active
  ON public.clientes(cliente_documento)
  WHERE deleted_at IS NULL AND cliente_documento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_integ_active
  ON public.clientes(integ_id)
  WHERE deleted_at IS NULL AND integ_id IS NOT NULL;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes' AND policyname = 'clientes_select_own_active'
  ) THEN
    CREATE POLICY clientes_select_own_active
      ON public.clientes FOR SELECT TO authenticated
      USING (deleted_at IS NULL AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes' AND policyname = 'clientes_insert_own'
  ) THEN
    CREATE POLICY clientes_insert_own
      ON public.clientes FOR INSERT TO authenticated
      WITH CHECK (deleted_at IS NULL AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes' AND policyname = 'clientes_update_own_active'
  ) THEN
    CREATE POLICY clientes_update_own_active
      ON public.clientes FOR UPDATE TO authenticated
      USING (deleted_at IS NULL AND user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes' AND policyname = 'clientes_service_role_all'
  ) THEN
    CREATE POLICY clientes_service_role_all
      ON public.clientes FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;

