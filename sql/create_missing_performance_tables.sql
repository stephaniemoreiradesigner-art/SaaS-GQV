-- ==============================================================================
-- CRIAÇÃO DAS TABELAS DE CAMPANHAS E PERFORMANCE (Se não existirem)
-- ==============================================================================

-- 1. Campanhas de Tráfego
CREATE TABLE IF NOT EXISTS public.traffic_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('facebook', 'google', 'tiktok', 'linkedin', 'pinterest')),
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'arquivada')),
    orcamento_diario DECIMAL(10,2) DEFAULT 0,
    objetivo TEXT, -- 'trafego', 'conversao', 'alcance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Performance de Criativos (Biblioteca de Anúncios)
CREATE TABLE IF NOT EXISTS public.ad_creative_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Pode ser vinculado a um criativo da nossa base OU ser um anúncio externo
    creative_id UUID REFERENCES public.ad_creatives(id) ON DELETE SET NULL, 
    
    -- Campanha vinculada
    campaign_id UUID REFERENCES public.traffic_campaigns(id) ON DELETE CASCADE,
    
    nome_anuncio TEXT NOT NULL, -- Nome como aparece no Gerenciador
    imagem_url TEXT, -- Caso não venha do ad_creatives
    
    -- Métricas
    custo DECIMAL(10,2) DEFAULT 0,
    conversoes INT DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    
    status TEXT DEFAULT 'ativo',
    data_analise DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Métricas Diárias (Para os gráficos da Visão Geral)
CREATE TABLE IF NOT EXISTS public.traffic_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES public.traffic_campaigns(id) ON DELETE CASCADE,
    data_metric DATE NOT NULL DEFAULT CURRENT_DATE,
    
    impressoes INT DEFAULT 0,
    clicks INT DEFAULT 0,
    custo DECIMAL(10,2) DEFAULT 0,
    conversoes INT DEFAULT 0,
    valor_vendas DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Segurança)
ALTER TABLE public.traffic_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creative_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Auth users manage campaigns" ON public.traffic_campaigns FOR ALL USING (public.is_tenant_match(cliente_id)) WITH CHECK (public.is_tenant_match(cliente_id));
CREATE POLICY "Auth users manage creative perf" ON public.ad_creative_performance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = ad_creative_performance.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = ad_creative_performance.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
);
CREATE POLICY "Auth users manage metrics" ON public.traffic_metrics FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = traffic_metrics.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.traffic_campaigns tc
        WHERE tc.id = traffic_metrics.campaign_id
        AND public.is_tenant_match(tc.cliente_id)
    )
);
