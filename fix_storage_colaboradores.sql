-- Script para corrigir/criar o bucket de armazenamento 'colaboradores'

-- 1. Inserir bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('colaboradores', 'colaboradores', true)
ON CONFLICT (id) DO UPDATE
SET public = true; -- Garante que seja público

-- 2. Remover políticas antigas para evitar duplicidade
DROP POLICY IF EXISTS "Permitir Upload Colaboradores" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Select Colaboradores" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Update Colaboradores" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Delete Colaboradores" ON storage.objects;

-- 3. Criar Políticas de Segurança (Permissivo para Autenticados para facilitar)
-- Upload (INSERT)
CREATE POLICY "Permitir Upload Colaboradores"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'colaboradores');

-- Leitura Pública (SELECT)
CREATE POLICY "Permitir Select Colaboradores"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'colaboradores');

-- Atualização (UPDATE)
CREATE POLICY "Permitir Update Colaboradores"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'colaboradores');

-- Deleção (DELETE)
CREATE POLICY "Permitir Delete Colaboradores"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'colaboradores');
