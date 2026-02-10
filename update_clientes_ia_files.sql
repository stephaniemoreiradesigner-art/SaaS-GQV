-- Adicionar colunas para arquivos de IA na tabela Clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS link_referencias TEXT,
ADD COLUMN IF NOT EXISTS link_identidade_visual TEXT;

COMMENT ON COLUMN public.clientes.link_referencias IS 'URL do arquivo de referências (PDF/Doc) para IA';
COMMENT ON COLUMN public.clientes.link_identidade_visual IS 'URL do arquivo de identidade visual para IA';
