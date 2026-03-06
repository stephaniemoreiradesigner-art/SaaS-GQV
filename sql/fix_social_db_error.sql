-- SCRIPT DE CORREÇÃO DE BANCO DE DADOS - SOCIAL MEDIA
-- Execute este script no SQL Editor do Supabase para corrigir o erro "Could not find column"

-- 1. Adicionar colunas obrigatórias que podem estar faltando
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS formato TEXT DEFAULT 'post',
ADD COLUMN IF NOT EXISTS tema TEXT,
ADD COLUMN IF NOT EXISTS conteudo_roteiro TEXT,
ADD COLUMN IF NOT EXISTS descricao_visual TEXT,
ADD COLUMN IF NOT EXISTS estrategia TEXT,
ADD COLUMN IF NOT EXISTS legenda TEXT,
ADD COLUMN IF NOT EXISTS legenda_linkedin TEXT,
ADD COLUMN IF NOT EXISTS legenda_tiktok TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'rascunho';

-- 2. Tornar calendar_id opcional (para evitar erro se a tabela foi criada com link para calendários)
ALTER TABLE public.social_posts 
ALTER COLUMN calendar_id DROP NOT NULL;

-- 3. Atualizar cache do PostgREST (Importante para o erro "schema cache")
NOTIFY pgrst, 'reload schema';
