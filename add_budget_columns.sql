DO $$
BEGIN
    -- Adiciona coluna 'orcamento_diario' na tabela traffic_metrics se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'orcamento_diario') THEN
        ALTER TABLE public.traffic_metrics ADD COLUMN orcamento_diario numeric DEFAULT 0;
    END IF;

    -- Adiciona coluna 'daily_budget' na tabela traffic_metrics como alias/backup se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'daily_budget') THEN
        ALTER TABLE public.traffic_metrics ADD COLUMN daily_budget numeric DEFAULT 0;
    END IF;

    -- Garante que traffic_campaigns tenha orcamento_diario
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'orcamento_diario') THEN
        ALTER TABLE public.traffic_campaigns ADD COLUMN orcamento_diario numeric DEFAULT 0;
    END IF;
END $$;