BEGIN;

DO $$
DECLARE
  tbl regclass;
BEGIN
  IF to_regclass('public.crm_clientes') IS NOT NULL THEN
    tbl := 'public.crm_clientes'::regclass;
  ELSIF to_regclass('public.clientes') IS NOT NULL THEN
    tbl := 'public.clientes'::regclass;
  ELSE
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS cliente_documento_formatado text', tbl);

  EXECUTE format($sql$
    WITH normalized AS (
      SELECT
        cliente_id,
        regexp_replace(cliente_documento, '\D', '', 'g') AS doc_digits
      FROM %1$s
      WHERE cliente_documento IS NOT NULL
    )
    UPDATE %1$s t
    SET
      cliente_documento = n.doc_digits,
      cliente_tipo_pessoa = CASE
        WHEN length(n.doc_digits) = 11 THEN 'FISICA'::public.cliente_tipo_pessoa_enum
        WHEN length(n.doc_digits) = 14 THEN 'JURIDICA'::public.cliente_tipo_pessoa_enum
        ELSE t.cliente_tipo_pessoa
      END,
      cliente_documento_formatado = CASE
        WHEN length(n.doc_digits) = 11 THEN
          substr(n.doc_digits, 1, 3) || '.' ||
          substr(n.doc_digits, 4, 3) || '.' ||
          substr(n.doc_digits, 7, 3) || '-' ||
          substr(n.doc_digits,10, 2)
        WHEN length(n.doc_digits) = 14 THEN
          substr(n.doc_digits, 1, 2) || '.' ||
          substr(n.doc_digits, 3, 3) || '.' ||
          substr(n.doc_digits, 6, 3) || '/' ||
          substr(n.doc_digits, 9, 4) || '-' ||
          substr(n.doc_digits,13, 2)
        ELSE t.cliente_documento_formatado
      END
    FROM normalized n
    WHERE t.cliente_id = n.cliente_id
  $sql$, tbl);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.conname = 'crm_clientes_documento_digits_only'
  ) THEN
    EXECUTE format($sql$
      ALTER TABLE %1$s
      ADD CONSTRAINT crm_clientes_documento_digits_only
      CHECK (cliente_documento IS NULL OR cliente_documento ~ '^\d+$') NOT VALID
    $sql$, tbl);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.conname = 'crm_clientes_documento_required_active'
  ) THEN
    EXECUTE format($sql$
      ALTER TABLE %1$s
      ADD CONSTRAINT crm_clientes_documento_required_active
      CHECK (deleted_at IS NOT NULL OR cliente_documento IS NOT NULL) NOT VALID
    $sql$, tbl);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.conname = 'crm_clientes_documento_formatado_required_active'
  ) THEN
    EXECUTE format($sql$
      ALTER TABLE %1$s
      ADD CONSTRAINT crm_clientes_documento_formatado_required_active
      CHECK (deleted_at IS NOT NULL OR cliente_documento_formatado IS NOT NULL) NOT VALID
    $sql$, tbl);
  END IF;

  EXECUTE 'DROP INDEX IF EXISTS public.uq_clientes_documento_active';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = tbl
      AND c.contype = 'u'
      AND c.conname = 'uq_crm_clientes_documento'
  ) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT uq_crm_clientes_documento UNIQUE (cliente_documento)', tbl);
  END IF;

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_crm_clientes_documento_formatado ON %s (cliente_documento_formatado)', tbl);
END;
$$;

CREATE OR REPLACE FUNCTION public.clientes_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  doc_digits text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
    NEW.deleted_at := NULL;
  END IF;

  doc_digits := NULL;
  IF NEW.cliente_documento IS NOT NULL THEN
    doc_digits := regexp_replace(NEW.cliente_documento, '\D', '', 'g');
    doc_digits := NULLIF(btrim(doc_digits), '');
    NEW.cliente_documento := doc_digits;
  END IF;

  IF NEW.deleted_at IS NULL THEN
    IF NEW.cliente_documento IS NULL THEN
      RAISE EXCEPTION 'cliente_documento é obrigatório (CPF/CNPJ)';
    END IF;

    IF length(NEW.cliente_documento) = 11 THEN
      NEW.cliente_tipo_pessoa := 'FISICA'::public.cliente_tipo_pessoa_enum;
      NEW.cliente_documento_formatado :=
        substr(NEW.cliente_documento, 1, 3) || '.' ||
        substr(NEW.cliente_documento, 4, 3) || '.' ||
        substr(NEW.cliente_documento, 7, 3) || '-' ||
        substr(NEW.cliente_documento,10, 2);
    ELSIF length(NEW.cliente_documento) = 14 THEN
      NEW.cliente_tipo_pessoa := 'JURIDICA'::public.cliente_tipo_pessoa_enum;
      NEW.cliente_documento_formatado :=
        substr(NEW.cliente_documento, 1, 2) || '.' ||
        substr(NEW.cliente_documento, 3, 3) || '.' ||
        substr(NEW.cliente_documento, 6, 3) || '/' ||
        substr(NEW.cliente_documento, 9, 4) || '-' ||
        substr(NEW.cliente_documento,13, 2);
    ELSE
      RAISE EXCEPTION 'cliente_documento inválido: precisa ter 11 (CPF) ou 14 (CNPJ) dígitos';
    END IF;
  ELSE
    IF NEW.cliente_documento IS NOT NULL THEN
      IF length(NEW.cliente_documento) = 11 THEN
        NEW.cliente_tipo_pessoa := 'FISICA'::public.cliente_tipo_pessoa_enum;
        NEW.cliente_documento_formatado :=
          substr(NEW.cliente_documento, 1, 3) || '.' ||
          substr(NEW.cliente_documento, 4, 3) || '.' ||
          substr(NEW.cliente_documento, 7, 3) || '-' ||
          substr(NEW.cliente_documento,10, 2);
      ELSIF length(NEW.cliente_documento) = 14 THEN
        NEW.cliente_tipo_pessoa := 'JURIDICA'::public.cliente_tipo_pessoa_enum;
        NEW.cliente_documento_formatado :=
          substr(NEW.cliente_documento, 1, 2) || '.' ||
          substr(NEW.cliente_documento, 3, 3) || '.' ||
          substr(NEW.cliente_documento, 6, 3) || '/' ||
          substr(NEW.cliente_documento, 9, 4) || '-' ||
          substr(NEW.cliente_documento,13, 2);
      END IF;
    END IF;
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

COMMIT;
