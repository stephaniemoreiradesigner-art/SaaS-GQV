-- Adicionar colunas para rastrear conclusão e duração nos logs de tráfego
ALTER TABLE public.traffic_logs
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.traffic_logs.completed_at IS 'Data e hora em que a tarefa foi marcada como feita';
COMMENT ON COLUMN public.traffic_logs.duration IS 'Texto descrevendo o tempo gasto (ex: "2 dias, 4 horas")';
