BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    (COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'is_admin') = 'true'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.cargo = 'ADMIN'
        AND COALESCE(p.ativo, true) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete is not allowed. Use soft delete (set deleted_at).';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clientes_prevent_hard_delete') THEN
    CREATE TRIGGER trg_clientes_prevent_hard_delete
    BEFORE DELETE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_hard_delete();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes_contatos'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.clientes_contatos
      ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clientes_contatos_prevent_hard_delete') THEN
    CREATE TRIGGER trg_clientes_contatos_prevent_hard_delete
    BEFORE DELETE ON public.clientes_contatos
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_hard_delete();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.clientes_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
    NEW.deleted_at := NULL;
  END IF;

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

CREATE OR REPLACE FUNCTION public.clientes_contatos_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
    NEW.deleted_at := NULL;
  END IF;

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

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_select_own_active ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_own ON public.clientes;
DROP POLICY IF EXISTS clientes_update_own_active ON public.clientes;
DROP POLICY IF EXISTS clientes_service_role_all ON public.clientes;

CREATE POLICY clientes_select
  ON public.clientes FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_admin()));

CREATE POLICY clientes_insert
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (deleted_at IS NULL AND (public.is_admin() OR user_id = auth.uid()));

CREATE POLICY clientes_update
  ON public.clientes FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.is_admin() OR user_id = auth.uid()))
  WITH CHECK (
    (public.is_admin() OR user_id = auth.uid())
    AND (public.is_admin() OR deleted_at IS NULL)
  );

DROP POLICY IF EXISTS clientes_contatos_select_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_insert_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_update_own ON public.clientes_contatos;
DROP POLICY IF EXISTS clientes_contatos_service_role_all ON public.clientes_contatos;

CREATE POLICY clientes_contatos_select
  ON public.clientes_contatos FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clientes c
      WHERE c.cliente_id = clientes_contatos.cliente_id
        AND c.deleted_at IS NULL
        AND (public.is_admin() OR c.user_id = auth.uid())
    )
    AND (public.is_admin() OR user_id = auth.uid())
  );

CREATE POLICY clientes_contatos_insert
  ON public.clientes_contatos FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND (
      public.is_admin()
      OR (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY clientes_contatos_update
  ON public.clientes_contatos FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.is_admin()
      OR (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.clientes c
          WHERE c.cliente_id = clientes_contatos.cliente_id
            AND c.deleted_at IS NULL
            AND c.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    (public.is_admin() OR user_id = auth.uid())
    AND (public.is_admin() OR deleted_at IS NULL)
  );

COMMIT;

