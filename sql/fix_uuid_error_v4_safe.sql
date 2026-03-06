-- CORREÇÃO FINAL DE ERRO UUID (V4 - SAFE)
-- Este script verifica quais tabelas existem antes de tentar alterar.
-- Ele foca nas tabelas traffic_metrics e traffic_campaigns que sabemos que existem.

DO $$
BEGIN

    -- 1. TRATAR TABELA DE MÉTRICAS (Principal fonte do erro)
    -- Verifica se a tabela existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_metrics') THEN
        
        -- Remove constraints (amarras) se existirem para permitir a mudança
        BEGIN
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_campaign_id_fkey;
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_adset_id_fkey;
            ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_ad_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Converte colunas para TEXTO (aceita qualquer ID)
        ALTER TABLE public.traffic_metrics ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        ALTER TABLE public.traffic_metrics ALTER COLUMN adset_id TYPE text USING adset_id::text;
        ALTER TABLE public.traffic_metrics ALTER COLUMN ad_id TYPE text USING ad_id::text;
        
    END IF;


    -- 2. TRATAR TABELA DE CAMPANHAS (Se existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_campaigns') THEN
        BEGIN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN id TYPE text USING id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;


    -- 3. TRATAR TABELA DE ADSETS (Se existir - Opcional)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_adsets') THEN
        BEGIN
            ALTER TABLE public.traffic_adsets DROP CONSTRAINT IF EXISTS traffic_adsets_campaign_id_fkey;
            ALTER TABLE public.traffic_adsets ALTER COLUMN id TYPE text USING id::text;
            ALTER TABLE public.traffic_adsets ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;


    -- 4. TRATAR TABELA DE ADS (Se existir - Opcional)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_ads') THEN
        BEGIN
            ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_adset_id_fkey;
            ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_campaign_id_fkey;
            ALTER TABLE public.traffic_ads ALTER COLUMN id TYPE text USING id::text;
            ALTER TABLE public.traffic_ads ALTER COLUMN adset_id TYPE text USING adset_id::text;
            ALTER TABLE public.traffic_ads ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

END $$;
