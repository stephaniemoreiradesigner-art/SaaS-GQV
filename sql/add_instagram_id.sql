-- Adicionar coluna instagram_id na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.clientes.instagram_id IS 'ID do Instagram Business (ex: 17841405822383833) para integração com Graph API';
