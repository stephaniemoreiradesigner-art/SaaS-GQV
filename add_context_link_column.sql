-- Adicionar coluna para link de conteúdos anteriores (contexto) na tabela clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS link_conteudos_anteriores TEXT;

COMMENT ON COLUMN public.clientes.link_conteudos_anteriores IS 'Link (Google Sheets/Docs) com histórico de conteúdos para evitar repetição';
