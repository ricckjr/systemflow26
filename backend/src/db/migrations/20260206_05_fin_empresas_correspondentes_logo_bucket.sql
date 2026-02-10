BEGIN;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'fin-empresas-correspondentes-logos',
    'fin-empresas-correspondentes-logos',
    true,
    3145728,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

  DROP POLICY IF EXISTS "fin_emp_corr_logos_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_logos_authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_logos_authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_logos_authenticated_delete" ON storage.objects;

  CREATE POLICY "fin_emp_corr_logos_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'fin-empresas-correspondentes-logos');

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL THEN
    CREATE POLICY "fin_emp_corr_logos_authenticated_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'fin-empresas-correspondentes-logos'
        AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "fin_emp_corr_logos_authenticated_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'fin-empresas-correspondentes-logos'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
      )
      WITH CHECK (
        bucket_id = 'fin-empresas-correspondentes-logos'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "fin_emp_corr_logos_authenticated_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'fin-empresas-correspondentes-logos'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
      );
    RETURN;
  END IF;

  CREATE POLICY "fin_emp_corr_logos_authenticated_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'fin-empresas-correspondentes-logos'
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "fin_emp_corr_logos_authenticated_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'fin-empresas-correspondentes-logos'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
    )
    WITH CHECK (
      bucket_id = 'fin-empresas-correspondentes-logos'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "fin_emp_corr_logos_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'fin-empresas-correspondentes-logos'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-logos/' || auth.uid()::text || '/%'
    );
END $$;

COMMIT;
