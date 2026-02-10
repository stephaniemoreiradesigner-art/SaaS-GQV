-- Adicionar colunas de links na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS link_briefing TEXT,
ADD COLUMN IF NOT EXISTS link_site TEXT,
ADD COLUMN IF NOT EXISTS link_lp TEXT,
ADD COLUMN IF NOT EXISTS link_drive TEXT,
ADD COLUMN IF NOT EXISTS link_persona TEXT;
