BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.clientes_contatos_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contato_email IS NOT NULL THEN
    NEW.contato_email := lower(btrim(NEW.contato_email));
  END IF;

  IF NEW.contato_telefone01 IS NOT NULL THEN
    NEW.contato_telefone01 := regexp_replace(NEW.contato_telefone01, '\D', '', 'g');
  END IF;

  IF NEW.contato_telefone02 IS NOT NULL THEN
    NEW.contato_telefone02 := regexp_replace(NEW.contato_telefone02, '\D', '', 'g');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.data_atualizacao := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.clientes_contatos (
  contato_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integ_id TEXT,
  cliente_id UUID NOT NULL REFERENCES public.clientes(cliente_id),
  contato_nome TEXT NOT NULL,
  contato_cargo TEXT,
  contato_telefone01 TEXT,
  contato_telefone02 TEXT,
  contato_email TEXT,
  user_id UUID REFERENCES auth.users(id),
  contato_obs TEXT,
  data_inclusao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_clientes_contatos_before_write'
  ) THEN
    CREATE TRIGGER trg_clientes_contatos_before_write
    BEFORE INSERT OR UPDATE ON public.clientes_contatos
    FOR EACH ROW
    EXECUTE FUNCTION public.clientes_contatos_before_write();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_contatos_cliente_id ON public.clientes_contatos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_contatos_user_id ON public.clientes_contatos(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_contatos_nome ON public.clientes_contatos(contato_nome);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_contatos_integ
  ON public.clientes_contatos(integ_id)
  WHERE integ_id IS NOT NULL;

ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes_contatos' AND policyname = 'clientes_contatos_select_own'
  ) THEN
    CREATE POLICY clientes_contatos_select_own
      ON public.clientes_contatos FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes_contatos' AND policyname = 'clientes_contatos_insert_own'
  ) THEN
    CREATE POLICY clientes_contatos_insert_own
      ON public.clientes_contatos FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes_contatos' AND policyname = 'clientes_contatos_update_own'
  ) THEN
    CREATE POLICY clientes_contatos_update_own
      ON public.clientes_contatos FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes_contatos' AND policyname = 'clientes_contatos_service_role_all'
  ) THEN
    CREATE POLICY clientes_contatos_service_role_all
      ON public.clientes_contatos FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;

