-- CORREÇÃO DEFINITIVA DE ERRO UUID (V3)
-- Este script remove as amarras (chaves estrangeiras) antes de converter tudo para TEXTO.
-- Isso resolve o erro "foreign key constraint cannot be implemented".

BEGIN;

-- 1. Remover as restrições que estão impedindo a mudança
-- (Se der erro dizendo que não existe, não tem problema, o comando ignora)
ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_campaign_id_fkey;
ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_adset_id_fkey;
ALTER TABLE public.traffic_metrics DROP CONSTRAINT IF EXISTS traffic_metrics_ad_id_fkey;

-- Também removemos das outras tabelas para garantir
ALTER TABLE public.traffic_adsets DROP CONSTRAINT IF EXISTS traffic_adsets_campaign_id_fkey;
ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_adset_id_fkey;
ALTER TABLE public.traffic_ads DROP CONSTRAINT IF EXISTS traffic_ads_campaign_id_fkey;


-- 2. Agora que não tem mais amarras, convertemos TODAS as colunas de ID para TEXTO
-- Tabela Campanhas
ALTER TABLE public.traffic_campaigns ALTER COLUMN id TYPE text USING id::text;

-- Tabela Conjuntos de Anúncios
ALTER TABLE public.traffic_adsets ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.traffic_adsets ALTER COLUMN campaign_id TYPE text USING campaign_id::text;

-- Tabela Anúncios
ALTER TABLE public.traffic_ads ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.traffic_ads ALTER COLUMN adset_id TYPE text USING adset_id::text;
ALTER TABLE public.traffic_ads ALTER COLUMN campaign_id TYPE text USING campaign_id::text;

-- Tabela Métricas (Onde estava dando o erro principal)
ALTER TABLE public.traffic_metrics ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
ALTER TABLE public.traffic_metrics ALTER COLUMN adset_id TYPE text USING adset_id::text;
ALTER TABLE public.traffic_metrics ALTER COLUMN ad_id TYPE text USING ad_id::text;

COMMIT;
