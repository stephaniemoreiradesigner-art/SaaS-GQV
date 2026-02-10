DO $$
BEGIN
    -- 1. Arruma a tabela 'ad_creative_performance' (que estava bloqueando o erro anterior)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_creative_performance') THEN
        -- Remove constraints que apontam para campaigns/adsets/ads
        BEGIN
            ALTER TABLE public.ad_creative_performance DROP CONSTRAINT IF EXISTS ad_creative_performance_campaign_id_fkey;
            ALTER TABLE public.ad_creative_performance DROP CONSTRAINT IF EXISTS ad_creative_performance_ad_id_fkey;
            ALTER TABLE public.ad_creative_performance DROP CONSTRAINT IF EXISTS ad_creative_performance_adset_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- Converte as colunas de referência para TEXT
        ALTER TABLE public.ad_creative_performance ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        
        -- Verifica e converte ad_id se existir
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ad_creative_performance' AND column_name = 'ad_id') THEN
            ALTER TABLE public.ad_creative_performance ALTER COLUMN ad_id TYPE text USING ad_id::text;
        END IF;
        
        -- Verifica e converte adset_id se existir
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ad_creative_performance' AND column_name = 'adset_id') THEN
            ALTER TABLE public.ad_creative_performance ALTER COLUMN adset_id TYPE text USING adset_id::text;
        END IF;
    END IF;

    -- 2. Arruma a tabela 'traffic_metrics' (alvo principal)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_metrics') THEN
        -- Remove constraints antigas
        BEGIN
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_campaign_id_fkey;
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_adset_id_fkey;
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_ad_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Converte IDs para TEXT
        ALTER TABLE public.traffic_metrics ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        ALTER TABLE public.traffic_metrics ALTER COLUMN adset_id TYPE text USING adset_id::text;
        ALTER TABLE public.traffic_metrics ALTER COLUMN ad_id TYPE text USING ad_id::text;
    END IF;

    -- 3. Agora libera a alteração na tabela PAI 'traffic_campaigns'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_campaigns') THEN
        ALTER TABLE public.traffic_campaigns ALTER COLUMN id TYPE text USING id::text;
    END IF;

    -- 4. Arruma 'traffic_adsets' se existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_adsets') THEN
         BEGIN
            ALTER TABLE public.traffic_adsets DROP CONSTRAINT IF EXISTS traffic_adsets_campaign_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER TABLE public.traffic_adsets ALTER COLUMN id TYPE text USING id::text;
        ALTER TABLE public.traffic_adsets ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
    END IF;

    -- 5. Arruma 'traffic_ads' se existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_ads') THEN
         BEGIN
            ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_campaign_id_fkey;
            ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_adset_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER TABLE public.traffic_ads ALTER COLUMN id TYPE text USING id::text;
        ALTER TABLE public.traffic_ads ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        ALTER TABLE public.traffic_ads ALTER COLUMN adset_id TYPE text USING adset_id::text;
    END IF;

END $$;