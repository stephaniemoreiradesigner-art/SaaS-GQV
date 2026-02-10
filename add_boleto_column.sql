-- Comando SQL para adicionar a coluna de URL do boleto na tabela 'financeiro'
-- Execute este comando no SQL Editor do seu projeto Supabase

ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

-- Nota: Certifique-se também de criar um Bucket de Storage chamado 'boletos' no painel do Supabase
-- e configurar as políticas de acesso (RLS) para permitir upload e leitura pública/autenticada.
