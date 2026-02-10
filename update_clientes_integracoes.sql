-- Adicionar colunas para Integrações na tabela Clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
ADD COLUMN IF NOT EXISTS facebook_page_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_id TEXT, -- ID do Instagram Business linkado à página
ADD COLUMN IF NOT EXISTS linkedin_id TEXT,
ADD COLUMN IF NOT EXISTS linkedin_token TEXT,
ADD COLUMN IF NOT EXISTS tiktok_id TEXT,
ADD COLUMN IF NOT EXISTS tiktok_token TEXT;

-- Comentário: Em produção real, tokens de longa duração devem ser renovados a cada 60 dias ou usar um sistema de Auth Refresh.
