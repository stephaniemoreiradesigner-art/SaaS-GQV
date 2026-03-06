-- 1. CORREÇÃO DAS TABELAS (Banco de Dados)
-- Habilita segurança
ALTER TABLE IF EXISTS public.clientes_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_media_posts ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir Insert Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Select Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Update Personas Autenticado" ON public.clientes_personas;
DROP POLICY IF EXISTS "Permitir Delete Personas Autenticado" ON public.clientes_personas;

DROP POLICY IF EXISTS "Permitir Insert Posts Autenticado" ON public.social_media_posts;
DROP POLICY IF EXISTS "Permitir Select Posts Autenticado" ON public.social_media_posts;
DROP POLICY IF EXISTS "Permitir Update Posts Autenticado" ON public.social_media_posts;
DROP POLICY IF EXISTS "Permitir Delete Posts Autenticado" ON public.social_media_posts;

-- Cria novas políticas permissivas para PERSONAS
CREATE POLICY "Permitir Insert Personas Autenticado" ON public.clientes_personas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir Select Personas Autenticado" ON public.clientes_personas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir Update Personas Autenticado" ON public.clientes_personas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir Delete Personas Autenticado" ON public.clientes_personas FOR DELETE TO authenticated USING (true);

-- Cria novas políticas permissivas para POSTS
CREATE POLICY "Permitir Insert Posts Autenticado" ON public.social_media_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir Select Posts Autenticado" ON public.social_media_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir Update Posts Autenticado" ON public.social_media_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir Delete Posts Autenticado" ON public.social_media_posts FOR DELETE TO authenticated USING (true);


-- 2. CORREÇÃO DO STORAGE (Arquivos PDF)
-- Garante que o bucket 'personas' existe e é público
INSERT INTO storage.buckets (id, name, public)
VALUES ('personas', 'personas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove políticas de storage antigas
DROP POLICY IF EXISTS "Permitir Upload Personas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Select Personas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Update Personas" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Delete Personas" ON storage.objects;

-- Cria novas políticas para o bucket 'personas'
CREATE POLICY "Permitir Upload Personas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'personas' );

CREATE POLICY "Permitir Select Personas"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'personas' );

CREATE POLICY "Permitir Update Personas"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'personas' );

CREATE POLICY "Permitir Delete Personas"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'personas' );
