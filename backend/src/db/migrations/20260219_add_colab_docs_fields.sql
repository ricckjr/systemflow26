
-- Adicionar campos de data na tabela colaboradores_documentos
ALTER TABLE public.colaboradores_documentos
ADD COLUMN IF NOT EXISTS data_emissao date,
ADD COLUMN IF NOT EXISTS data_vencimento date;

-- Criar bucket 'colaboradores-docs' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('colaboradores-docs', 'colaboradores-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket
DROP POLICY IF EXISTS "Public Access for Colaboradores Docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload Colaboradores Docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update Colaboradores Docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete Colaboradores Docs" ON storage.objects;

CREATE POLICY "Public Access for Colaboradores Docs"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'colaboradores-docs' );

CREATE POLICY "Authenticated users can upload Colaboradores Docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'colaboradores-docs' );

CREATE POLICY "Authenticated users can update Colaboradores Docs"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'colaboradores-docs' )
WITH CHECK ( bucket_id = 'colaboradores-docs' );

CREATE POLICY "Authenticated users can delete Colaboradores Docs"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'colaboradores-docs' );
