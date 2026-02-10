-- Renomear coluna 'metadados' para 'metadata' para compatibilidade com n8n/LangChain
ALTER TABLE public.base_conhecimento 
RENAME COLUMN metadados TO metadata;