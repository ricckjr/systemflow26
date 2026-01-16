BEGIN;

-- 1. Cria o bucket 'task-attachments' se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  true,
  52428800, -- Limite de 50MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- 2. Configura Políticas de Segurança (RLS) para o Storage

-- Permitir Upload para Usuários Autenticados
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Permitir Leitura Pública (já que o bucket é público, mas reforçando acesso via API)
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

-- Permitir Deleção apenas pelo dono do arquivo (quem fez o upload)
DROP POLICY IF EXISTS "Users can delete their own task attachments" ON storage.objects;
CREATE POLICY "Users can delete their own task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND owner = auth.uid());

COMMIT;
