-- Habilita o uso de armazenamento para o bucket 'posts'

-- Tenta criar o bucket via SQL (caso você não tenha criado no painel)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- REMOVE políticas antigas para evitar conflitos (erros de "policy already exists")
DROP POLICY IF EXISTS "Imagens Publicas" ON storage.objects;
DROP POLICY IF EXISTS "Upload Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Update Autenticado" ON storage.objects;

-- CRIA NOVAS POLÍTICAS (REGRAS DE USO)

-- 1. Qualquer pessoa pode VER as imagens (Select)
CREATE POLICY "Imagens Publicas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'posts' );

-- 2. Usuários logados podem ENVIAR imagens (Insert)
CREATE POLICY "Upload Autenticado"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'posts' AND auth.role() = 'authenticated' );

-- 3. Usuários logados podem ATUALIZAR imagens (Update)
CREATE POLICY "Update Autenticado"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'posts' AND auth.role() = 'authenticated' );
