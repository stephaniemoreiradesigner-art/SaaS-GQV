-- Atualizar tabela Clientes com campos de integração de Anúncios
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT,
ADD COLUMN IF NOT EXISTS meta_access_token TEXT;

-- Tabela para armazenar métricas de performance de criativos/anúncios
CREATE TABLE IF NOT EXISTS public.ad_creatives_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    
    platform TEXT DEFAULT 'facebook', -- facebook, google, tiktok
    ad_id TEXT, -- ID do anúncio na plataforma
    ad_name TEXT, -- Nome do anúncio
    thumbnail_url TEXT, -- URL da imagem/vídeo
    
    -- Métricas Principais
    spend NUMERIC(10, 2) DEFAULT 0, -- Valor gasto
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr NUMERIC(5, 2) DEFAULT 0, -- %
    cpc NUMERIC(10, 2) DEFAULT 0,
    cpm NUMERIC(10, 2) DEFAULT 0,
    
    conversions INTEGER DEFAULT 0,
    cpa NUMERIC(10, 2) DEFAULT 0, -- Custo por Aquisição
    roas NUMERIC(5, 2) DEFAULT 0, -- Return On Ad Spend
    roi NUMERIC(5, 2) DEFAULT 0, -- Return On Investment
    
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, ARCHIVED
    date_report DATE DEFAULT CURRENT_DATE -- Data de referência dos dados
);

-- RLS
ALTER TABLE public.ad_creatives_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage ad performance" ON public.ad_creatives_performance;

CREATE POLICY "Users can manage ad performance" ON public.ad_creatives_performance
    FOR ALL USING (auth.role() = 'authenticated');
