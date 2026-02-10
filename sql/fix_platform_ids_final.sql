-- Script para corrigir e padronizar as colunas de IDs de Anúncios na tabela de Clientes
-- Execute este script no Editor SQL do Supabase

-- 1. Adicionar colunas padronizadas se não existirem
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS linkedin_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS tiktok_ad_account_id TEXT;

-- 2. Comentário explicativo
-- Agora a tabela 'clientes' tem os campos:
-- meta_ad_account_id
-- google_ad_account_id
-- linkedin_ad_account_id
-- tiktok_ad_account_id

-- Isso garante que o código JS atualizado possa ler e escrever corretamente.
