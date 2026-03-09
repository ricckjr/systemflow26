BEGIN;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'crm-propostas-comerciais-docs',
    'crm-propostas-comerciais-docs',
    false,
    52428800,
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

  DROP POLICY IF EXISTS "crm_propostas_comerciais_docs_select" ON storage.objects;
  DROP POLICY IF EXISTS "crm_propostas_comerciais_docs_insert" ON storage.objects;
  DROP POLICY IF EXISTS "crm_propostas_comerciais_docs_update" ON storage.objects;
  DROP POLICY IF EXISTS "crm_propostas_comerciais_docs_delete" ON storage.objects;

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL THEN
    CREATE POLICY "crm_propostas_comerciais_docs_select"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'crm-propostas-comerciais-docs'
        AND name LIKE 'crm-propostas-comerciais-docs/%'
      );

    CREATE POLICY "crm_propostas_comerciais_docs_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'crm-propostas-comerciais-docs'
        AND name LIKE 'crm-propostas-comerciais-docs/%'
      );

    CREATE POLICY "crm_propostas_comerciais_docs_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'crm-propostas-comerciais-docs'
        AND owner = auth.uid()
        AND name LIKE 'crm-propostas-comerciais-docs/%'
      )
      WITH CHECK (
        bucket_id = 'crm-propostas-comerciais-docs'
        AND owner = auth.uid()
        AND name LIKE 'crm-propostas-comerciais-docs/%'
      );

    CREATE POLICY "crm_propostas_comerciais_docs_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'crm-propostas-comerciais-docs'
        AND owner = auth.uid()
        AND name LIKE 'crm-propostas-comerciais-docs/%'
      );

    RETURN;
  END IF;

  CREATE POLICY "crm_propostas_comerciais_docs_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'crm-propostas-comerciais-docs'
      AND public.has_permission(auth.uid(), 'CRM', 'VIEW')
      AND name LIKE 'crm-propostas-comerciais-docs/%'
    );

  CREATE POLICY "crm_propostas_comerciais_docs_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'crm-propostas-comerciais-docs'
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-propostas-comerciais-docs/%'
    );

  CREATE POLICY "crm_propostas_comerciais_docs_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'crm-propostas-comerciais-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-propostas-comerciais-docs/%'
    )
    WITH CHECK (
      bucket_id = 'crm-propostas-comerciais-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-propostas-comerciais-docs/%'
    );

  CREATE POLICY "crm_propostas_comerciais_docs_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'crm-propostas-comerciais-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'CRM', 'EDIT')
      AND name LIKE 'crm-propostas-comerciais-docs/%'
    );
END $$;

COMMIT;
