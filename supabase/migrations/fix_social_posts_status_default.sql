-- SQL para corrigir default da coluna status na tabela social_posts
-- Deve ser executado no editor SQL do Supabase ou via migração

ALTER TABLE public.social_posts 
ALTER COLUMN status SET DEFAULT 'draft';

-- Opcional: Atualizar registros antigos que estejam com 'rascunho' se existirem e violarem constraint
-- UPDATE public.social_posts SET status = 'draft' WHERE status = 'rascunho';
