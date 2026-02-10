-- Atualização Completa do Banco de Dados para o Novo Formato

-- 1. Tabela Social Posts (Adicionando colunas de detalhe)
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS plataformas TEXT,
ADD COLUMN IF NOT EXISTS descricao_visual TEXT,
ADD COLUMN IF NOT EXISTS conteudo_roteiro TEXT,
ADD COLUMN IF NOT EXISTS hora_agendada TIME DEFAULT '10:00';

-- 2. Tabela Clientes (Adicionando link de contexto)
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS link_conteudos_anteriores TEXT;
