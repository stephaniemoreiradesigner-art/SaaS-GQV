-- Adiciona coluna para armazenar o ID externo (Facebook) na tabela de campanhas
-- Isso permite que o n8n encontre a campanha correta antes de salvar as métricas
ALTER TABLE public.traffic_campaigns 
ADD COLUMN IF NOT EXISTS facebook_id TEXT;

-- Cria um índice para garantir que a busca pelo ID do Facebook seja rápida
CREATE INDEX IF NOT EXISTS idx_traffic_campaigns_fb_id ON public.traffic_campaigns(facebook_id);
