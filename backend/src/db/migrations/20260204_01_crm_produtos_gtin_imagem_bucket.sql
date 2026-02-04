BEGIN;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.crm_produtos ADD COLUMN IF NOT EXISTS gtin_ean TEXT;
  ALTER TABLE public.crm_produtos ADD COLUMN IF NOT EXISTS imagem_path TEXT;
END $$;

DO $$
BEGIN
  IF to_regclass('public.crm_produtos_imagens') IS NOT NULL THEN
    RETURN;
  END IF;

  CREATE TABLE public.crm_produtos_imagens (
    imagem_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prod_id UUID NOT NULL REFERENCES public.crm_produtos(prod_id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX crm_produtos_imagens_prod_idx ON public.crm_produtos_imagens(prod_id);

  ALTER TABLE public.crm_produtos_imagens ENABLE ROW LEVEL SECURITY;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_produtos_imagens TO authenticated;

  DROP POLICY IF EXISTS rbac_crm_produtos_imagens_select ON public.crm_produtos_imagens;
  DROP POLICY IF EXISTS rbac_crm_produtos_imagens_insert ON public.crm_produtos_imagens;
  DROP POLICY IF EXISTS rbac_crm_produtos_imagens_update ON public.crm_produtos_imagens;
  DROP POLICY IF EXISTS rbac_crm_produtos_imagens_delete ON public.crm_produtos_imagens;
  DROP POLICY IF EXISTS rbac_crm_produtos_imagens_service_role_all ON public.crm_produtos_imagens;

  CREATE POLICY rbac_crm_produtos_imagens_select
    ON public.crm_produtos_imagens FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), 'CRM', 'VIEW'));

  CREATE POLICY rbac_crm_produtos_imagens_insert
    ON public.crm_produtos_imagens FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));

  CREATE POLICY rbac_crm_produtos_imagens_update
    ON public.crm_produtos_imagens FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'))
    WITH CHECK (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));

  CREATE POLICY rbac_crm_produtos_imagens_delete
    ON public.crm_produtos_imagens FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), 'CRM', 'CONTROL'));

  CREATE POLICY rbac_crm_produtos_imagens_service_role_all
    ON public.crm_produtos_imagens FOR ALL TO service_role
    USING (true) WITH CHECK (true);
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('produtos', 'produtos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

  DROP POLICY IF EXISTS "produtos_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "produtos_authenticated_insert" ON storage.objects;
  DROP POLICY IF EXISTS "produtos_authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "produtos_authenticated_delete" ON storage.objects;

  CREATE POLICY "produtos_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'produtos');

  CREATE POLICY "produtos_authenticated_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'produtos'
      AND name LIKE 'produtos/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "produtos_authenticated_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'produtos'
      AND owner = auth.uid()
      AND name LIKE 'produtos/' || auth.uid()::text || '/%'
    )
    WITH CHECK (
      bucket_id = 'produtos'
      AND owner = auth.uid()
      AND name LIKE 'produtos/' || auth.uid()::text || '/%'
    );

  CREATE POLICY "produtos_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'produtos'
      AND owner = auth.uid()
      AND name LIKE 'produtos/' || auth.uid()::text || '/%'
    );
END $$;

COMMIT;
