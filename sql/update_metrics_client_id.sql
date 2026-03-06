-- Adiciona coluna cliente_id na tabela de métricas para facilitar buscas diretas
ALTER TABLE public.traffic_metrics 
ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Cria índice para busca rápida por cliente
CREATE INDEX IF NOT EXISTS idx_traffic_metrics_cliente_id ON public.traffic_metrics(cliente_id);

-- Opcional: Adiciona colunas para armazenar IDs externos se ainda não existirem
ALTER TABLE public.traffic_metrics
ADD COLUMN IF NOT EXISTS adset_id TEXT,
ADD COLUMN IF NOT EXISTS adset_name TEXT,
ADD COLUMN IF NOT EXISTS ad_id TEXT,
ADD COLUMN IF NOT EXISTS ad_name TEXT,
ADD COLUMN IF NOT EXISTS frequency NUMERIC(10,6),
ADD COLUMN IF NOT EXISTS reach INT;
