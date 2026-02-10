-- Atualização COMPLETA para converter métricas de tráfego para TEXT
-- Isso permite receber valores formatados como "R$ 35,00" do n8n sem erro

DO $$
BEGIN
    -- 1. Tabela traffic_metrics
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_metrics') THEN
        
        -- Colunas comuns (Português/Inglês)
        -- spend / custo
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'spend') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN spend TYPE text USING spend::text;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'custo') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN custo TYPE text USING custo::text;
        END IF;

        -- impressions / impressoes
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'impressions') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN impressions TYPE text USING impressions::text;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'impressoes') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN impressoes TYPE text USING impressoes::text;
        END IF;

        -- clicks (geralmente igual)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'clicks') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN clicks TYPE text USING clicks::text;
        END IF;

        -- conversions / conversoes
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'conversions') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN conversions TYPE text USING conversions::text;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'conversoes') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN conversoes TYPE text USING conversoes::text;
        END IF;

        -- revenue / valor_vendas
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'revenue') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN revenue TYPE text USING revenue::text;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'valor_vendas') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN valor_vendas TYPE text USING valor_vendas::text;
        END IF;

        -- cpc
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'cpc') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN cpc TYPE text USING cpc::text;
        END IF;
        
        -- ctr
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'ctr') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN ctr TYPE text USING ctr::text;
        END IF;

        -- orcamento_diario / daily_budget
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'orcamento_diario') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN orcamento_diario TYPE text USING orcamento_diario::text;
        ELSE
            ALTER TABLE public.traffic_metrics ADD COLUMN orcamento_diario text;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_metrics' AND column_name = 'daily_budget') THEN
            ALTER TABLE public.traffic_metrics ALTER COLUMN daily_budget TYPE text USING daily_budget::text;
        END IF;

    END IF;

    -- 2. Tabela traffic_campaigns (para garantir consistência)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_campaigns') THEN
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'orcamento_diario') THEN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN orcamento_diario TYPE text USING orcamento_diario::text;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'daily_budget') THEN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN daily_budget TYPE text USING daily_budget::text;
        END IF;
        
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'traffic_campaigns' AND column_name = 'spend') THEN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN spend TYPE text USING spend::text;
        END IF;

    END IF;

END $$;
