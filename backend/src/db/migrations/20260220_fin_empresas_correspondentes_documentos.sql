BEGIN;

CREATE TABLE IF NOT EXISTS public.fin_empresas_correspondentes_documentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.fin_empresas_correspondentes(empresa_id) ON DELETE CASCADE,
  nome text NOT NULL,
  arquivo_nome text,
  arquivo_url text,
  data_emissao date,
  data_vencimento date,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.fin_empresas_correspondentes_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_emp_corr_docs_read" ON public.fin_empresas_correspondentes_documentos;
DROP POLICY IF EXISTS "fin_emp_corr_docs_insert" ON public.fin_empresas_correspondentes_documentos;
DROP POLICY IF EXISTS "fin_emp_corr_docs_update" ON public.fin_empresas_correspondentes_documentos;
DROP POLICY IF EXISTS "fin_emp_corr_docs_delete" ON public.fin_empresas_correspondentes_documentos;

CREATE POLICY "fin_emp_corr_docs_read"
  ON public.fin_empresas_correspondentes_documentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fin_emp_corr_docs_insert"
  ON public.fin_empresas_correspondentes_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

CREATE POLICY "fin_emp_corr_docs_update"
  ON public.fin_empresas_correspondentes_documentos
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'))
  WITH CHECK (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

CREATE POLICY "fin_emp_corr_docs_delete"
  ON public.fin_empresas_correspondentes_documentos
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL'));

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'fin-empresas-correspondentes-docs',
    'fin-empresas-correspondentes-docs',
    true,
    10485760,
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

  DROP POLICY IF EXISTS "fin_emp_corr_docs_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_docs_authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_docs_authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "fin_emp_corr_docs_authenticated_delete" ON storage.objects;

  CREATE POLICY "fin_emp_corr_docs_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'fin-empresas-correspondentes-docs');

  IF to_regprocedure('public.has_permission(uuid,text,text)') IS NULL THEN
    CREATE POLICY "fin_emp_corr_docs_authenticated_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'fin-empresas-correspondentes-docs'
        AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "fin_emp_corr_docs_authenticated_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'fin-empresas-correspondentes-docs'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
      )
      WITH CHECK (
        bucket_id = 'fin-empresas-correspondentes-docs'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
      );

    CREATE POLICY "fin_emp_corr_docs_authenticated_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'fin-empresas-correspondentes-docs'
        AND owner = auth.uid()
        AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
      );
    RETURN;
  END IF;

  CREATE POLICY "fin_emp_corr_docs_authenticated_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'fin-empresas-correspondentes-docs'
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "fin_emp_corr_docs_authenticated_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'fin-empresas-correspondentes-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
    )
    WITH CHECK (
      bucket_id = 'fin-empresas-correspondentes-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "fin_emp_corr_docs_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'fin-empresas-correspondentes-docs'
      AND owner = auth.uid()
      AND public.has_permission(auth.uid(), 'FINANCEIRO', 'CONTROL')
      AND name LIKE 'fin-empresas-correspondentes-docs/' || auth.uid()::text || '/%'
    );
END $$;

COMMIT;

