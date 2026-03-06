DO $$
BEGIN
    -- Converte colunas numéricas para TEXT na tabela traffic_metrics
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_metrics') THEN
        
        -- Custo (spend)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'custo' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN custo TYPE text USING custo::text;
        END IF;

        -- Impressões
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'impressoes' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN impressoes TYPE text USING impressoes::text;
        END IF;

        -- Clicks
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'clicks' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN clicks TYPE text USING clicks::text;
        END IF;

        -- Conversões
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'conversoes' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN conversoes TYPE text USING conversoes::text;
        END IF;

        -- Valor Vendas (revenue)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'valor_vendas' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN valor_vendas TYPE text USING valor_vendas::text;
        END IF;

        -- Orçamento Diário
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'orcamento_diario' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN orcamento_diario TYPE text USING orcamento_diario::text;
        END IF;

        -- Daily Budget (alias)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'daily_budget' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN daily_budget TYPE text USING daily_budget::text;
        END IF;

    END IF;

    -- Converte colunas numéricas para TEXT na tabela traffic_campaigns (se necessário)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_campaigns') THEN
        
        -- Orçamento Diário
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'orcamento_diario' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN orcamento_diario TYPE text USING orcamento_diario::text;
        END IF;

        -- Spend (gasto total)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'spend' AND data_type != 'text') THEN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN spend TYPE text USING spend::text;
        END IF;

    END IF;

END $$;