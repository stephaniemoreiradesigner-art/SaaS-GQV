-- Adicionar colunas de URL de referência na tabela Clientes
-- Estas colunas servem para a IA ler o conteúdo público como referência de estilo
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT;

COMMENT ON COLUMN public.clientes.instagram_url IS 'URL do perfil público do Instagram (ex: https://instagram.com/suamarca)';
