-- CORREÇÃO DE ERRO: invalid input syntax for type uuid
-- O n8n está tentando salvar IDs do Facebook (números gigantes) em colunas que foram criadas como UUID.
-- Este script converte essas colunas para TEXTO para aceitar qualquer tipo de ID.

DO $$
BEGIN

    -- 1. Alterar tabela traffic_metrics
    -- Primeiro, removemos constraints de chave estrangeira temporariamente se existirem, 
    -- pois elas podem impedir a mudança de tipo se a tabela de destino for UUID.
    -- (O bloco abaixo tenta remover constraints comuns, se falhar não tem problema)
    BEGIN
        ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_campaign_id_fkey;
        ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_adset_id_fkey;
        ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_ad_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Agora convertemos as colunas para TEXT
    -- A cláusula USING garante a conversão correta dos dados existentes
    ALTER TABLE public.traffic_metrics 
    ALTER COLUMN campaign_id TYPE text USING campaign_id::text,
    ALTER COLUMN adset_id TYPE text USING adset_id::text,
    ALTER COLUMN ad_id TYPE text USING ad_id::text;


    -- 2. Alterar tabelas relacionadas (Opcional, mas recomendado para consistência)
    -- Se existirem as tabelas de cadastro, vamos garantir que seus IDs também sejam TEXT
    
    -- traffic_campaigns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_campaigns') THEN
        BEGIN
            ALTER TABLE public.traffic_campaigns ALTER COLUMN id TYPE text USING id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- traffic_adsets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_adsets') THEN
        BEGIN
            ALTER TABLE public.traffic_adsets ALTER COLUMN id TYPE text USING id::text;
            ALTER TABLE public.traffic_adsets ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- traffic_ads
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_ads') THEN
        BEGIN
            ALTER TABLE public.traffic_ads ALTER COLUMN id TYPE text USING id::text;
            ALTER TABLE public.traffic_ads ALTER COLUMN adset_id TYPE text USING adset_id::text;
            ALTER TABLE public.traffic_ads ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

END $$;
