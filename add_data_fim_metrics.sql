-- Adicionar coluna data_metric_fim para suportar periodos (Macro SaaS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'data_metric_fim') THEN
        ALTER TABLE public.traffic_metrics ADD COLUMN data_metric_fim DATE;
    END IF;
END $$;

-- Atualizar linhas antigas para que data_metric_fim seja igual a data_metric (assumindo dados diarios ou pontuais antigos)
UPDATE public.traffic_metrics SET data_metric_fim = data_metric WHERE data_metric_fim IS NULL;
