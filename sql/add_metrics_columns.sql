-- Adiciona colunas faltantes na tabela de métricas para suportar dados órfãos (n8n)
ALTER TABLE public.traffic_metrics ADD COLUMN IF NOT EXISTS plataforma TEXT;
ALTER TABLE public.traffic_metrics ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- Opcional: Index para melhorar performance de filtro por plataforma
CREATE INDEX IF NOT EXISTS idx_traffic_metrics_plataforma ON public.traffic_metrics(plataforma);
