-- Script para deletar todas as tabelas e referências do módulo Social Media
-- RODE ESTE SCRIPT NO "SQL EDITOR" DO SUPABASE

BEGIN;

-- 1. Dropar tabelas relacionadas ao Social Media
-- Usa CASCADE para garantir que dependências sejam removidas
DROP TABLE IF EXISTS public.social_media_posts CASCADE;
DROP TABLE IF EXISTS public.social_media_accounts CASCADE;
DROP TABLE IF EXISTS public.social_media_diario_bordo CASCADE;
DROP TABLE IF EXISTS public.social_posts CASCADE; -- Nome alternativo encontrado em scripts antigos

-- 2. Limpar storage (se houver bucket específico)
-- Nota: O bucket 'social_media' ou similar deve ser removido via interface do Supabase Storage se existir,
-- mas podemos remover as políticas de acesso aqui.
DROP POLICY IF EXISTS "Permitir Insert Posts Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Select Posts Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Update Posts Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Delete Posts Autenticado" ON storage.objects;

-- 3. Limpar permissões em Colaboradores (Opcional, mas recomendado para limpeza de dados)
-- Remove 'social_media' do array de permissões de todos os colaboradores
UPDATE public.colaboradores
SET permissoes = array_remove(permissoes, 'social_media')
WHERE 'social_media' = ANY(permissoes);

COMMIT;
