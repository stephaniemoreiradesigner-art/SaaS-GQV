-- Atualização das tabelas para suportar dados detalhados do Meta Ads (via n8n)

-- 1. Atualizar tabela de CAMPANHAS (traffic_campaigns)
-- Adicionando colunas para IDs externos e orçamentos detalhados
ALTER TABLE public.traffic_campaigns 
ADD COLUMN IF NOT EXISTS external_id TEXT, -- ID da Campanha ou AdSet no Facebook (ex: 238...)
ADD COLUMN IF NOT EXISTS orcamento_total DECIMAL(10,2) DEFAULT 0, -- Lifetime Budget
ADD COLUMN IF NOT EXISTS status_efetivo TEXT, -- Effective Status (ACTIVE, PAUSED, ARCHIVED, etc)
ADD COLUMN IF NOT EXISTS campaign_id_externo TEXT; -- ID da Campanha Pai (caso esta linha seja um AdSet)

-- Criar índice para busca rápida por ID externo (útil para o n8n fazer upsert)
CREATE INDEX IF NOT EXISTS idx_traffic_campaigns_external_id ON public.traffic_campaigns(external_id);

-- 2. Atualizar tabela de MÉTRICAS (traffic_metrics)
-- Garantir que temos campos para IDs externos se necessário
ALTER TABLE public.traffic_metrics
ADD COLUMN IF NOT EXISTS ad_id_externo TEXT, -- ID do Anúncio no Facebook
ADD COLUMN IF NOT EXISTS adset_id_externo TEXT; -- ID do AdSet no Facebook

-- Comentário:
-- Agora você pode mapear no n8n:
-- id (do Facebook) -> traffic_campaigns.external_id
-- daily_budget -> traffic_campaigns.orcamento_diario
-- lifetime_budget -> traffic_campaigns.orcamento_total
-- effective_status -> traffic_campaigns.status_efetivo
-- name -> traffic_campaigns.nome
-- status -> traffic_campaigns.status
