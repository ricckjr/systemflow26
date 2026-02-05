BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_oportunidades') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_oportunidades
    ADD COLUMN IF NOT EXISTS pedido_compra_path text;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'crm-pedidos-compra',
    'crm-pedidos-compra',
    true,
    10485760,
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

  DROP POLICY IF EXISTS "crm_pedidos_compra_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "crm_pedidos_compra_authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "crm_pedidos_compra_authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "crm_pedidos_compra_authenticated_delete" ON storage.objects;

  CREATE POLICY "crm_pedidos_compra_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'crm-pedidos-compra');

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL THEN
    CREATE POLICY "crm_pedidos_compra_authenticated_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'crm-pedidos-compra'
        AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "crm_pedidos_compra_authenticated_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'crm-pedidos-compra'
        AND owner = auth.uid()
        AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
      )
      WITH CHECK (
        bucket_id = 'crm-pedidos-compra'
        AND owner = auth.uid()
        AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "crm_pedidos_compra_authenticated_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'crm-pedidos-compra'
        AND owner = auth.uid()
        AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
      );
    RETURN;
  END IF;

  CREATE POLICY "crm_pedidos_compra_authenticated_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'crm-pedidos-compra'
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "crm_pedidos_compra_authenticated_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'crm-pedidos-compra'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
    )
    WITH CHECK (
      bucket_id = 'crm-pedidos-compra'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "crm_pedidos_compra_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'crm-pedidos-compra'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-pedidos-compra/' || auth.uid()::text || '/%'
    );
END $$;

COMMIT;
